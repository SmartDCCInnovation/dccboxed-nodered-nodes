/*
 * Created on Tue Sep 20 2022
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

import { NodeMessage } from 'node-red'
import {
  Properties as GBCSNodeProperties,
  GbcsNode,
} from './gbcs-node.properties'
export type { KeyDefinition } from './gbcs-node.properties'

export interface Properties extends GBCSNodeProperties {
  outputUtrn: string
  outputCounter: string
  signerEUI: string
  signerEUI_type: 'msg' | 'eui'
  deviceEUI: string
  deviceEUI_type: 'msg' | 'eui'
  counter: string
  counter_type: 'msg' | 'num' | 'epoch'
  value: string
  value_type: 'msg' | 'num'
  class: string
  class_type: 'msg' | 'class'
  enableInject: boolean
}

export interface Node extends GbcsNode {
  outputUtrn: (msg: NodeMessage, value: unknown) => void
  outputCounter: (msg: NodeMessage, value: unknown) => void
  signerEUI: (msg: NodeMessage) => unknown
  deviceEUI: (msg: NodeMessage) => unknown
  counter: (msg: NodeMessage) => unknown
  value: (msg: NodeMessage) => unknown
  class: (msg: NodeMessage) => unknown
}
