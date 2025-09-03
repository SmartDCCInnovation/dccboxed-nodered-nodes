/*
 * Created on Tue Aug 16 2022
 *
 * Copyright (c) 2022 Smart DCC Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import type { NodeDef, NodeMessage, NodeAPI, NodeContext } from 'node-red'

import type {
  ConfigNode,
  DspEndpoint,
  Headers,
  MessageStore,
  Properties,
  WSMessageDTO,
} from './dccboxed-config.properties'

import * as bodyParser from 'body-parser'
import { signDuis, validateDuis } from '@smartdcc/duis-sign-wrap'
import {
  constructDuis,
  isSimplifiedDuisOutputResponse,
  isSimplifiedDuisResponseBody_ResponseMessage_X,
  parseDuis,
  SimplifiedDuisInput,
  SimplifiedDuisOutputResponse,
} from '@smartdcc/duis-parser'
import { EventEmitter } from 'node:events'
import {
  BoxedKeyStore,
  resolveHeaders,
  Headers as KeyStoreHeaders,
} from '@smartdcc/dccboxed-keystore'
import got from 'got'
import { parse as contentType } from 'content-type'
import { inspect } from 'node:util'
import { signGroupingHeader } from '@smartdcc/gbcs-parser'
import { ServerKeyStore } from './gbcs-node.common'
import { open } from 'node:fs/promises'

const endpoints: Record<DspEndpoint, string> = {
  'Non-Device Service': '/api/v1/serviceD',
  'Send Command Service': '/api/v1/serviceS',
  'Transform Service': '/api/v1/serviceT',
}

function buildHeaders(headers: Headers, context: NodeContext): KeyStoreHeaders {
  return Object.fromEntries(
    Object.entries(headers).map(([name, header]) => [
      name,
      header.type === 'global'
        ? () => {
            return context.global.get(header.value) as string
          }
        : header.value,
    ]),
  )
}

export = function (RED: NodeAPI) {
  const usedEndpoints: string[] = []

  function ConfigConstruct(this: ConfigNode, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    this.config = config
    this.events = new EventEmitter()

    if (usedEndpoints.indexOf(config.responseEndpoint) !== -1) {
      this.error('duis response endpoint is not unique')
    }
    usedEndpoints.push(config.responseEndpoint)

    this.smkiHeaders = buildHeaders(
      this.config.smkiHeaders ?? {},
      this.context(),
    )
    this.duisHeaders = buildHeaders(
      this.config.duisHeaders ?? {},
      this.context(),
    )

    BoxedKeyStore.new(
      `${this.config.smkiTls ? 'https' : 'http'}://${this.config.host}:${this.config.smkiPort || 8083}`,
      (config.localKeyStore?.length ?? 0) > 1
        ? config.localKeyStore
        : undefined,
      undefined,
      this.smkiHeaders,
    )
      .then((ks) => {
        this.keyStore = ks
      })
      .catch((e) => {
        RED.log.error(`failed to load dcc boxed key store: ${e}`)
      })

    const messageStore: MessageStore & {
      dict: Record<string, NodeMessage>
    } = {
      dict: {},
      store(reqid, msg) {
        if (!reqid) {
          return
        }
        const id = `${reqid.originatorId}:${reqid.targetId}:${reqid.counter}`
        /* shallow copy, consider if deep is appropriate */
        this.dict[id] = Object.assign({}, msg)
      },
      retrieve(reqid) {
        const id = `${reqid?.originatorId}:${reqid?.targetId}:${reqid?.counter}`
        if (reqid && id in this.dict) {
          const msg = this.dict[id]
          delete this.dict[id]
          return msg
        }
        return undefined
      },
    }
    this.messageStore = messageStore

    const asyncWorkerSend = async (
      status: (status: string) => void | Promise<void>,
      req: SimplifiedDuisInput,
      endpoint: DspEndpoint,
      preserveCounter: boolean,
    ): Promise<SimplifiedDuisOutputResponse> => {
      await status(`${endpoint}: signing duis`)

      const preSignedXml = constructDuis('simplified', req)
      const signedXml = await signDuis({ xml: preSignedXml, preserveCounter })
      this.logger(signedXml)

      await status(`${endpoint}: requesting`)

      const response = await got(
        `${this.config.duisTls ? 'https' : 'http'}://${this.config.host}:${this.config.port || 8079}${endpoints[endpoint]}`,
        {
          timeout: { request: 3000 },
          headers: await resolveHeaders(this.duisHeaders, {
            'Content-Type': 'application/xml',
          }),
          method: 'POST',
          body: signedXml,
          throwHttpErrors: true,
          followRedirect: true,
        },
      )

      if (
        typeof response.headers['content-type'] !== 'string' ||
        contentType(response.headers['content-type']).type !== 'application/xml'
      ) {
        throw new Error(
          `incorrect content-type header received, expected application/xml, received: ${response.headers['content-type']}`,
        )
      }
      await status(`${endpoint}: validating`)
      this.logger(response.body)
      const validatedDuis = await validateDuis({ xml: response.body })

      const res = parseDuis('simplified', validatedDuis)
      if (!isSimplifiedDuisOutputResponse(res)) {
        RED.log.error(inspect(response, { depth: 10, colors: true }))
        throw new Error('invalid simplified duis response')
      }

      this.status({
        fill: res.header.responseCode.startsWith('I') ? 'green' : 'red',
        shape: 'dot',
        text: `${endpoint}: result code: ${res.header.responseCode}`,
      })
      return res
    }

    this.logger = () => {
      /* no op */
    }
    switch (config.loggerType) {
      case 'stdout':
        this.logger = (s) => RED.log.info(s)
        break
      case 'file':
        ;(async () => {
          if (typeof config.logger === 'string') {
            this.logfile = await open(config.logger, 'a', 0o660)
            this.logger = async (s) => {
              await this.logfile?.write(`--- ${new Date().toString()} ---\n`)
              await this.logfile?.write(s)
              await this.logfile?.write('\n')
            }
          } else {
            throw new Error('duis logging disabled as no logger file provided')
          }
        })().catch((e) => {
          RED.log.warn(`unable to start duis logger: ${e}`)
        })
        break
    }

    this.request = async (status, endpoint, req) => {
      const res = await asyncWorkerSend(
        status,
        req,
        endpoint,
        req.header.requestId.counter !== 0 &&
          req.header.requestId.counter !== BigInt(0),
      )
      if (
        endpoint === 'Transform Service' &&
        res.header.responseCode === 'I0'
      ) {
        if (
          res.header.requestId &&
          isSimplifiedDuisResponseBody_ResponseMessage_X('PreCommand', res.body)
        ) {
          const signedGBCS = await signGroupingHeader(
            res.header.requestId?.originatorId,
            res.body.ResponseMessage.PreCommand.GBCSPayload,
            (eui, type, options) =>
              ServerKeyStore(this, RED, eui, type, options),
          )
          const signedPrecommandDuis: SimplifiedDuisInput = {
            header: {
              type: 'request',
              requestId: res.header.requestId,
              commandVariant: 5,
              serviceReference: res.body.ResponseMessage.ServiceReference,
              serviceReferenceVariant:
                res.body.ResponseMessage.ServiceReferenceVariant,
            },
            body: { SignedPreCommand: { GBCSPayload: signedGBCS } },
          }

          return asyncWorkerSend(
            status,
            signedPrecommandDuis,
            'Send Command Service',
            true,
          )
        }
        RED.log.error(inspect(res, { depth: 10, colors: true }))
        throw new Error('unexpected response from transform service')
      }
      return res
    }

    RED.httpNode.post(
      this.config.responseEndpoint,
      bodyParser.text({ inflate: true, type: 'application/xml' }),
      (req, res, next) => {
        if (typeof req.body !== 'string') {
          next()
          return
        }
        this.logger(req.body)
        validateDuis({ xml: req.body })
          .then((validated) => parseDuis('simplified', validated))
          .then((duis) => {
            if (isSimplifiedDuisOutputResponse(duis)) {
              return duis
            }
            throw new Error('expected duis response')
          })
          .then((duis) => {
            res.status(204)
            res.send()
            this.events.emit(
              'duis',
              duis,
              this.messageStore.retrieve(duis.header.requestId),
            )
          })
          .catch((e) => {
            RED.log.warn('async response failed duis validation')
            try {
              /* if no listeners, error emitter throws error */
              this.events.emit('error', e)
            } catch {
              RED.log.warn(e)
            }
            res.status(400)
            res.send()
          })
      },
    )

    this.on('close', () => {
      usedEndpoints.length = 0
      this.events.removeAllListeners()
      ;(<unknown[]>RED.httpNode._router.stack)?.forEach((layer, i, layers) => {
        if (typeof layer === 'object' && layer !== null && 'route' in layer) {
          const route = (
            layer as {
              route?: { path?: string; methods?: Record<string, boolean> }
            }
          ).route
          if (
            route?.path === this.config.responseEndpoint &&
            route?.methods?.['post']
          ) {
            layers.splice(i, 1)
          }
        }
      })
      if (this.logfile !== undefined) {
        this.logfile.close()
      }
    })

    this.publish = (nodeId, body) => {
      const payload: WSMessageDTO = { id: this.id, sourceNode: nodeId, ...body }
      RED.comms.publish(
        `smartdcc/config/${this.id}/${body.kind}`,
        payload,
        false,
      )
    }
  }
  RED.nodes.registerType('dccboxed-config', ConfigConstruct)
}
