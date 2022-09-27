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

import { minimizeMessage, parseGbcsMessage } from '@smartdcc/gbcs-parser'
import type { NodeDef, NodeAPI } from 'node-red'

import type { GbcsParserNode, Properties } from './gbcs-parser.properties'
import { bootstrap } from './gbcs-node.common'
import { setMessageProperty } from './util'

export = function (RED: NodeAPI) {
  function GbcsParser(this: GbcsParserNode, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    bootstrap.bind(this)(config, RED)

    {
      const input =
        (config.input ?? '').trim() ||
        'payload.response.body.ResponseMessage.GBCSPayload'
      this.input = (msg) => RED.util.getMessageProperty(msg, input)
    }
    this.output = setMessageProperty(RED, config.output, 'payload.gbcs')

    this.on('input', (msg, send, done) => {
      const maybePayload = this.input(msg)
      let payload: string
      if (Buffer.isBuffer(maybePayload)) {
        payload = maybePayload.toString('utf-8')
      } else if (typeof maybePayload === 'string') {
        payload = maybePayload
      } else {
        done(new Error('payload must be string or buffer'))
        return
      }
      parseGbcsMessage(payload, this.keyStore)
        .then((b) => {
          this.output(msg, minimizeMessage(b))
          send(msg)
        })
        .catch(done)
    })
  }
  RED.nodes.registerType('gbcs-parser', GbcsParser)
}
