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

export interface KeyDefinition {
  type: 'certificate' | 'privateKey'
  usage: 'DS' | 'KA'
  name: string
  eui: string
  content: string
}

export interface Properties {
  server?: string
  keys: KeyDefinition[]
}

import type { KeyStore } from '@smartdcc/gbcs-parser'
import type { Node } from 'node-red'
import type { ConfigNode } from './dccboxed-config.properties'
import type { KeyObject } from 'node:crypto'

export interface LocalKeyEntry {
  eui: string
  type: 'DS' | 'KA'
  privateKey: boolean
  key: KeyObject
}

export interface GbcsNode extends Node<{}> {
  server?: ConfigNode
  keyStore: KeyStore
  localKeys: LocalKeyEntry[]
}
