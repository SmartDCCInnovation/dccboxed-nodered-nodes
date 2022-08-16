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

import { isXMLData, SimplifiedDuisInput } from '@smartdcc/duis-parser'
import { parseGbcsMessage } from '@smartdcc/gbcs-parser'
import type { NodeDef, NodeAPI, NodeMessage } from 'node-red'
import { ConfigNode } from './dccboxed-config.properties'

import type { ReceiveNode, Properties } from './dccboxed-receive.properties'
import { ServerKeyStore } from './gbcs-node.common'

export = function (RED: NodeAPI) {
  function DCCBoxedReceive(this: ReceiveNode, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    const node = this
    node.server = RED.nodes.getNode(config.server) as ConfigNode

    {
      const output = (config.output ?? '').trim() || 'payload.response'
      this.output = (msg, value) => {
        RED.util.setMessageProperty(msg, output, value, true)
      }
    }

    if (config.decodeGbcs) {
      const gbcsOutput = (config.gbcsOutput ?? '').trim() || 'payload.gbcs'
      this.gbcsOutput = (msg, value) => {
        RED.util.setMessageProperty(msg, gbcsOutput, value, true)
      }
    }

    let tid: NodeJS.Timeout

    function NewDuis(
      sd: SimplifiedDuisInput,
      msg: NodeMessage | undefined
    ): void {
      if (sd.header.type === 'response') {
        node.status({
          fill: 'green',
          shape: 'dot',
          text: `result code: ${sd.header.responseCode}`,
        })
        clearTimeout(tid)
        tid = setTimeout(() => {
          node.status({})
        }, 5000)
        msg = msg ?? { _msgid: '' }
        node.output(msg, sd)
        if (sd.header.responseCode !== 'I0') {
          node.send([null, null, null, msg])
        } else {
          if ('ResponseMessage' in sd.body) {
            if (
              node.gbcsOutput &&
              isXMLData(sd.body.ResponseMessage) &&
              'GBCSPayload' in sd.body.ResponseMessage &&
              typeof sd.body.ResponseMessage.GBCSPayload === 'string'
            ) {
              const go = node.gbcsOutput
              const _msg = msg
              parseGbcsMessage(
                sd.body.ResponseMessage.GBCSPayload,
                (eui, type, privateKey) =>
                  ServerKeyStore(node.server, RED, eui, type, privateKey)
              )
                .then((gbcs) => {
                  go(_msg, gbcs)
                  node.send([_msg, null, null, null])
                })
                .catch((e) => node.error(e))
            } else {
              node.send([msg, null, null, null])
            }
          } else if ('DeviceAlertMessage' in sd.body) {
            if (
              node.gbcsOutput &&
              isXMLData(sd.body.DeviceAlertMessage) &&
              'GBCSPayload' in sd.body.DeviceAlertMessage &&
              typeof sd.body.DeviceAlertMessage.GBCSPayload === 'string'
            ) {
              const go = node.gbcsOutput
              const _msg = msg
              parseGbcsMessage(
                sd.body.DeviceAlertMessage.GBCSPayload,
                (eui, type, privateKey) =>
                  ServerKeyStore(node.server, RED, eui, type, privateKey)
              )
                .then((gbcs) => {
                  go(_msg, gbcs)
                  node.send([null, _msg, null, null])
                })
                .catch((e) => node.error(e))
              node.status({
                fill: 'green',
                shape: 'dot',
                text: `device alert code: ${sd.body.DeviceAlertMessage.AlertCode}`,
              })
            } else {
              node.send([null, msg, null, null])
            }
          } else if ('DCCAlertMessage' in sd.body) {
            if (node.gbcsOutput && isXMLData(sd.body.DCCAlertMessage)) {
              node.status({
                fill: 'green',
                shape: 'dot',
                text: `dcc alert code: ${sd.body.DCCAlertMessage.DCCAlertCode}`,
              })
            }
            node.send([null, null, msg, null])
          } else {
            node.warn('unknown message received: ' + JSON.stringify(sd))
          }
        }
      }
    }

    node.server.events.on('duis', NewDuis)
    node.on('close', () => {
      node.server.events.removeListener('duis', NewDuis)
    })
  }
  RED.nodes.registerType('dccboxed-receive', DCCBoxedReceive)
}
