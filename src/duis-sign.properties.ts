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
  mode: 'sign' | 'validate'
  preserveCounter: boolean
  output?: string
  input?: string
}

import type { Node as RedNode } from 'node-red'

export interface Node extends RedNode {
  output: (msg: object, signedXml: string) => void
  input: (msg: object) => unknown
  preserveCounter: boolean
}
