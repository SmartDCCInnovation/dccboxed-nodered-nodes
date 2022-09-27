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
import { signDuis, validateDuis } from '@smartdcc/duis-sign-wrap'

import type { Node, Properties } from './duis-sign.properties'
import { setMessageProperty } from './util'

export = function (RED: NodeAPI) {
  function DuisSign(this: Node, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    this.preserveCounter = config.preserveCounter
    {
      const input = (config.input ?? '').trim() || 'payload.request'
      this.input = (msg) => RED.util.getMessageProperty(msg, input)
    }
    this.output = setMessageProperty(RED, config.output, 'payload.request')
    this.on('input', (msg, send, done) => {
      const input = this.input(msg)
      if (typeof input === 'string' || Buffer.isBuffer(input)) {
        ;(config.mode === 'validate' ? validateDuis : signDuis)({
          xml: input,
        })
          .then((signed) => {
            this.output(msg, signed)
            send(msg)
          })
          .catch(done)
      } else {
        done(new Error('payload should be string or buffer'))
      }
    })
  }
  RED.nodes.registerType('duis-sign', DuisSign)
}
