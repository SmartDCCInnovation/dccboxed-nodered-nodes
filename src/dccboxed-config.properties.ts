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

export interface HeaderDef {
  type: string
  value: string
}

export interface Headers {
  [name: string]: HeaderDef
}

export interface Properties {
  host: string
  port: string /* duis: 8079 */
  duisTls: boolean /* false */
  smkiPort: string /* smki: 8083 */
  smkiTls: boolean /* false */
  responseEndpoint: string
  localKeyStore?: string
  loggerType: string
  logger?: string
  duisHeaders: Headers
  smkiHeaders: Headers
}

import type {
  RequestId,
  SimplifiedDuisInputRequest,
  SimplifiedDuisOutputResponse,
} from '@smartdcc/duis-parser'
import { EventEmitter } from 'node:events'
import {
  BoxedKeyStore,
  Headers as KeyStoreHeaders,
} from '@smartdcc/dccboxed-keystore'
import type { Node, NodeMessage } from 'node-red'
import type { FileHandle } from 'node:fs/promises'

export interface MessageStore {
  store(reqid: RequestId<number | bigint> | undefined, msg: NodeMessage): void
  retrieve(
    reqid: RequestId<number | bigint> | undefined,
  ): NodeMessage | undefined
}

interface DuisEmitter extends EventEmitter {
  on(
    eventName: 'duis',
    listener: (
      message: SimplifiedDuisOutputResponse,
      msg: NodeMessage | undefined,
    ) => void,
  ): this
  on(eventName: 'error', listener: (e: Error) => void): this
}

export type DspEndpoint =
  | 'Non-Device Service'
  | 'Send Command Service'
  | 'Transform Service'

export interface ConfigNode extends Node {
  config: Properties
  events: DuisEmitter
  keyStore?: BoxedKeyStore
  messageStore: MessageStore
  request: (
    status: (status: string) => void | Promise<void>,
    endpoint: DspEndpoint,
    duis: SimplifiedDuisInputRequest,
  ) => Promise<SimplifiedDuisOutputResponse>
  logger: (msg: string) => void | Promise<void>
  logfile?: FileHandle
  publish: (nodeId: string, body: WSMessageBody) => void
  duisHeaders: KeyStoreHeaders
  smkiHeaders: KeyStoreHeaders
}

export interface WSMessageNotification {
  kind: 'notification'
  message: string
  type?: 'compact' | 'success' | 'warning' | 'error'
  timeout?: number
}

export type WSMessageBody = WSMessageNotification

export type WSMessageDTO = { id: string; sourceNode: string } & WSMessageBody
