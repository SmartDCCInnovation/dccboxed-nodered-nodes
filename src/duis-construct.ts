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
import {
  constructDuis,
  isSimplifiedDuisInput,
  isXMLData,
  XMLData,
} from '@smartdcc/duis-parser'

import type { Node, Properties } from './duis-construct.properties'
import { setMessageProperty } from './util'

export = function (RED: NodeAPI) {
  function DuisConstruct(this: Node, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    {
      const input = (config.input ?? '').trim() || 'payload.request'
      this.input = (msg) => RED.util.getMessageProperty(msg, input)
    }
    this.output = setMessageProperty(RED, config.output, 'payload.request')
    this.on('input', (msg, send, done) => {
      const input = this.input(msg)
      if (config.minimal) {
        if (isSimplifiedDuisInput(input)) {
          this.output(msg, constructDuis('simplified', input))
        } else {
          done(new Error('input should be a simplified duis structure'))
          return
        }
      } else {
        if (isXMLData(input)) {
          this.output(msg, constructDuis('normal', input as XMLData))
        } else {
          done(new Error('input should be json'))
          return
        }
      }
      send(msg)
    })
  }
  RED.nodes.registerType('duis-construct', DuisConstruct)
}
