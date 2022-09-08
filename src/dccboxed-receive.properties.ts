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

import type { ConfigNode } from './dccboxed-config.properties'

export interface Properties {
  server: string
  output: string
  decodeGbcs: boolean
  gbcsOutput: string
  outputResponsesFilter?: string
  outputDeviceAlertsFilter?: string
  outputDCCAlertsFilter?: string
  outputResponsesFilterType: string
  outputDeviceAlertsFilterType: string
  outputDCCAlertsFilterType: string
  outputs: number
}

import type { Node, NodeMessage } from 'node-red'

export interface ReceiveNode extends Node {
  server: ConfigNode
  output: (msg: object, val: unknown) => void
  gbcsOutput?: (msg: object, val: unknown) => void
  outputResponsesFilter: RegExp
  outputDeviceAlertsFilter: RegExp
  outputDCCAlertsFilter: RegExp
  sendOutput(
    opt:
      | {
          type: 'response' | 'devicealert' | 'dccalert' | 'error'
          payload: NodeMessage
        }
      | { type: 'none' }
  ): void
}
