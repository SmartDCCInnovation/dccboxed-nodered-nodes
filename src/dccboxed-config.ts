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

import type { NodeDef, NodeAPI, NodeMessage } from 'node-red'

import type {
  ConfigNode,
  MessageStore,
  Properties,
} from './dccboxed-config.properties'

import * as bodyParser from 'body-parser'
import { validateDuis } from '@smartdcc/duis-sign-wrap'
import {
  isSimplifiedDuisOutputResponse,
  parseDuis,
} from '@smartdcc/duis-parser'
import { EventEmitter } from 'node:events'
import { BoxedKeyStore } from '@smartdcc/dccboxed-keystore'

export = function (RED: NodeAPI) {
  function ConfigConstruct(this: ConfigNode, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    this.config = config
    this.events = new EventEmitter()

    BoxedKeyStore.new(
      config.host,
      (config.localKeyStore?.length ?? 0) > 1 ? config.localKeyStore : undefined
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

    RED.httpNode.post(
      this.config.responseEndpoint,
      bodyParser.text({ inflate: true, type: 'application/xml' }),
      (req, res, next) => {
        if (typeof req.body !== 'string') {
          next()
          return
        }
        console.log(req.body)
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
              this.messageStore.retrieve(duis.header.requestId)
            )
          })
          .catch((e) => {
            RED.log.debug(`request failed duis validation`)
            this.events.emit('error', e)
            res.status(400)
            res.send()
          })
      }
    )

    this.on('close', () => {
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
    })
  }
  RED.nodes.registerType('dccboxed-config', ConfigConstruct)
}
