/*
 * Created on Fri Aug 11 2023
 *
 * Copyright (c) 2023 Smart DCC Limited
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

import type { Tariff } from '@smartdcc/duis-templates'
import type { Node as RedNode, NodeMessage } from 'node-red'

export interface Properties {
  tariffBody?: string
  input?: string
  input_type: 'msg' | 'example'
  output?: string
  originatorEUI?: string
  originatorEUI_type: 'msg' | 'eui' | 'flow' | 'global'
  targetEUI?: string
  targetEUI_type: 'msg' | 'eui' | 'flow' | 'global'
  deafultName?: string
}

export interface Node extends RedNode {
  tariffBody?: Tariff
  input: (msg: NodeMessage) => string | object | undefined
  output: (msg: NodeMessage, value: unknown) => void
  originatorEUI: (msg: NodeMessage) => Promise<string | undefined>
  targetEUI: (msg: NodeMessage) => Promise<string | undefined>
}
