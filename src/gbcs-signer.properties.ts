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

import { EUI } from '@smartdcc/dccboxed-keystore'
import type { NodeMessage } from 'node-red'
import {
  Properties as GBCSNodeProperties,
  GbcsNode,
} from './gbcs-node.properties'
export type { KeyDefinition } from './gbcs-node.properties'

export interface Properties extends GBCSNodeProperties {
  precommand: string
  signedprecommand: string
  signerEUI: string
  signerEUI_type: 'msg' | 'eui'
}

export interface GbcsSignerNode extends GbcsNode {
  precommand: (msg: NodeMessage) => unknown
  signedprecommand: (msg: NodeMessage, value: unknown) => void
  signerEUI: string | EUI
}
