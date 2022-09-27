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

import type { NodeDef, NodeAPI, NodeStatus } from 'node-red'
import { ConfigNode } from './dccboxed-config.properties'

import type { Node, Properties } from './dccboxed-send.properties'

import {
  lookupCV,
  isCommandVariant,
  isSimplifiedDuisInputRequest,
} from '@smartdcc/duis-parser'

export = function (RED: NodeAPI) {
  function DCCBoxedSend(this: Node, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server) as ConfigNode
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
    let timerId: NodeJS.Timeout | undefined = undefined
    const setStatus: (status: NodeStatus) => void = (status) => {
      if (timerId !== undefined) {
        clearTimeout(timerId)
      }
      this.status(status)
      timerId = setTimeout(() => {
        this.status({})
        timerId = undefined
      }, 5000)
    }
    this.on('input', (msg, send, done) => {
      const req = this.input(msg)
      if (!isSimplifiedDuisInputRequest(req)) {
        setStatus({
          fill: 'yellow',
          shape: 'dot',
          text: 'bad input',
        })
        done(new Error('input not a simplified duis request structure'))
        return
      }

      const cv = isCommandVariant(req.header.commandVariant)
        ? req.header.commandVariant
        : lookupCV(req.header.commandVariant)

      if (cv.number === 3 || cv.number === 7) {
        setStatus({
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

      this.server
        .request(
          (s) =>
            setStatus({
              fill: 'blue',
              shape: 'dot',
              text: s,
            }),
          cv.webService,
          req
        )
        .then((duis) => {
          this.output(msg, duis)

          if (duis.header.responseCode === 'I0') {
            setStatus({
              fill: 'green',
              shape: 'dot',
              text: `result code: ${duis.header.responseCode}`,
            })
            send([msg, null, null])
          } else if (duis.header.responseCode === 'I99') {
            if (duis.header.requestId) {
              this.server.messageStore.store(duis.header.requestId, msg)
            }
            setStatus({
              fill: 'green',
              shape: 'dot',
              text: `result code: ${duis.header.responseCode}`,
            })
            send([null, msg, null])
          } else {
            setStatus({
              fill: 'red',
              shape: 'dot',
              text: `result code: ${duis.header.responseCode}`,
            })
            send([null, null, msg])
          }
        })
        .catch((e) => {
          setStatus({
            fill: 'red',
            shape: 'dot',
            text: 'sending failed',
          })
          done(e)
        })
    })
  }
  RED.nodes.registerType('dccboxed-send', DCCBoxedSend)
}
