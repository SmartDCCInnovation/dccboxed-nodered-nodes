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

import type { NodeDef, NodeAPI } from 'node-red'
import { ConfigNode } from './dccboxed-config.properties'

import type { SendNode, Properties } from './dccboxed-send.properties'

import got from 'got'
import {
  constructDuis,
  isSimplifiedDuisInput,
  lookupCV,
  parseDuis,
  SimplifiedDuisInput,
} from '@smartdcc/duis-parser'
import { isCommandVariant } from '@smartdcc/duis-parser/dist/cv'
import { signDuis, validateDuis } from '@smartdcc/duis-sign-wrap'
import { parse as contentType } from 'content-type'

import { inspect } from 'node:util'
import { signGroupingHeader } from '@smartdcc/gbcs-parser'
import { ServerKeyStore } from './gbcs-node.common'
import {
  isSimplifiedDuisOutputResponse,
  isSimplifiedDuisResponseBody_ResponseMessage_X,
  SimplifiedDuisOutputResponse,
} from '@smartdcc/duis-parser/dist/duis'

export = function (RED: NodeAPI) {
  function DCCBoxedSend(this: SendNode, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    const node = this
    node.server = RED.nodes.getNode(config.server) as ConfigNode
    {
      const input = (config.input ?? '').trim() || 'payload.request'
      this.input = (msg) => RED.util.getMessageProperty(msg, input)
    }
    {
      const output = (config.output ?? '').trim() || 'payload.response'
      this.output = (msg, value) => {
        RED.util.setMessageProperty(msg, output, value, true)
      }
    }
    node.on('input', (msg, send, done) => {
      const req = this.input(msg)
      if (!isSimplifiedDuisInput(req)) {
        node.status({
          fill: 'yellow',
          shape: 'dot',
          text: 'bad input',
        })
        done(new Error('input not a simplified duis structure'))
        return
      }

      if (req.header.type !== 'request') {
        node.status({
          fill: 'yellow',
          shape: 'dot',
          text: 'bad input',
        })
        done(new Error('tried to send something that is not a duis request'))
        return
      }
      const cv = isCommandVariant(req.header.commandVariant)
        ? req.header.commandVariant
        : lookupCV(req.header.commandVariant)

      if (cv.number === 3 || cv.number == 7) {
        node.status({
          fill: 'yellow',
          shape: 'dot',
          text: 'unsupported cv',
        })
        done(
          new Error(
            `tried to send a cv not supported by DCC Boxed: ${cv.number}`
          )
        )
        return
      }
      const endpoints = {
        'Non-Device Service': '/api/v1/serviceD',
        'Send Command Service': '/api/v1/serviceS',
        'Transform Service': '/api/v1/serviceT',
      }

      const asyncWorkerSend = async (
        req: SimplifiedDuisInput,
        endpoint:
          | 'Non-Device Service'
          | 'Send Command Service'
          | 'Transform Service',
        preserveCounter: boolean
      ): Promise<SimplifiedDuisOutputResponse> => {
        node.status({
          fill: 'blue',
          shape: 'dot',
          text: `${endpoint}: signing duis`,
        })

        const preSignedXml = constructDuis('simplified', req)
        console.log(preSignedXml)
        const signedXml = await signDuis({ xml: preSignedXml, preserveCounter })

        node.status({
          fill: 'blue',
          shape: 'dot',
          text: `${endpoint}: requesting`,
        })
        const response = await got(
          `http://${node.server.config.host}:${node.server.config.port}${endpoints[endpoint]}`,
          {
            timeout: { request: 3000 },
            headers: { 'Content-Type': 'application/xml' },
            method: 'POST',
            body: signedXml,
            throwHttpErrors: true,
            followRedirect: true,
          }
        )

        if (
          typeof response.headers['content-type'] !== 'string' ||
          contentType(response.headers['content-type']).type !==
            'application/xml'
        ) {
          throw new Error(
            `incorrect content-type header received, expected application/xml, received: ${response.headers['content-type']}`
          )
        }
        node.status({
          fill: 'blue',
          shape: 'dot',
          text: `${endpoint}: validating`,
        })
        console.log(response.body)
        const validatedDuis = await validateDuis({ xml: response.body })

        const res = parseDuis('simplified', validatedDuis)
        if (!isSimplifiedDuisOutputResponse(res)) {
          console.log(inspect(response, { depth: 10, colors: true }))
          throw new Error('invalid simplified duis')
        }

        node.status({
          fill: res.header.responseCode.startsWith('I') ? 'green' : 'red',
          shape: 'dot',
          text: `${endpoint}: result code: ${res.header.responseCode}`,
        })
        return res
      }

      asyncWorkerSend(req, cv.webService, false)
        .then(async (duis) => {
          if (
            cv.webService === 'Transform Service' &&
            duis.header.responseCode === 'I0'
          ) {
            if (
              duis.header.requestId &&
              isSimplifiedDuisResponseBody_ResponseMessage_X(
                'PreCommand',
                duis.body
              )
            ) {
              const signedGBCS = await signGroupingHeader(
                duis.header.requestId?.originatorId,
                duis.body.ResponseMessage.PreCommand.GBCSPayload,
                (eui, type, privateKey) =>
                  ServerKeyStore(this.server, RED, eui, type, privateKey)
              )
              const signedPrecommandDuis: SimplifiedDuisInput = {
                header: {
                  type: 'request',
                  requestId: duis.header.requestId,
                  commandVariant: 5,
                  serviceReference: duis.body.ResponseMessage.ServiceReference,
                  serviceReferenceVariant:
                    duis.body.ResponseMessage.ServiceReferenceVariant,
                },
                body: { SignedPreCommand: { GBCSPayload: signedGBCS } },
              }

              return asyncWorkerSend(
                signedPrecommandDuis,
                'Send Command Service',
                true
              )
            }
            RED.log.warn(duis)
            throw new Error('unexpected response from transform service')
          }
          return duis
        })
        .then((duis) => {
          this.output(msg, duis)

          if (duis.header.responseCode === 'I0') {
            send([msg, null, null])
          } else if (duis.header.responseCode === 'I99') {
            if (duis.header.requestId) {
              this.server.messageStore.store(duis.header.requestId, msg)
            }
            send([null, msg, null])
          } else {
            send([null, null, msg])
          }
        })
        .catch((e) => {
          node.status({
            fill: 'red',
            shape: 'dot',
            text: 'sending failed',
          })
          done(e)
        })
        .finally(() => {
          /* todo: use return timerid to avoid accidental overwrite */
          setTimeout(() => node.status({}), 5000)
        })
    })
  }
  RED.nodes.registerType('dccboxed-send', DCCBoxedSend)
}
