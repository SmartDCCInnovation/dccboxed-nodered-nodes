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

export interface Properties {
  host: string
  port: number
  responseEndpoint: string
  localKeyStore?: string
}

import type {
  RequestId,
  SimplifiedDuisOutputResponse,
} from '@smartdcc/duis-parser'
import { EventEmitter } from 'node:events'
import { BoxedKeyStore } from '@smartdcc/dccboxed-keystore'
import type { Node, NodeMessage } from 'node-red'

export interface MessageStore {
  store(reqid: RequestId | undefined, msg: NodeMessage): void
  retrieve(reqid: RequestId | undefined): NodeMessage | undefined
}

interface DuisEmitter extends EventEmitter {
  on(
    eventName: 'duis',
    listener: (
      message: SimplifiedDuisOutputResponse,
      msg: NodeMessage | undefined
    ) => void
  ): this
  on(eventName: 'error', listener: (e: Error) => void): this
}

export interface ConfigNode extends Node {
  config: Properties
  events: DuisEmitter
  keyStore?: BoxedKeyStore
  messageStore: MessageStore
}
