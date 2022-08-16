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

import type {
  CommandVariant,
  ServiceReferenceVariant,
} from '@smartdcc/duis-parser'
import type { Node as RedNode } from 'node-red'
import type Fuse from 'fuse.js'

export interface Properties {
  template: string
  templateValid: 'true' | 'false'
  minimal: boolean
  output?: string
  enableInject: boolean
  originatorEUI?: string
  originatorEUI_type: 'default' | 'msg' | 'eui'
  targetEUI?: string
  targetEUI_type: 'default' | 'msg' | 'eui'
  deafultName?: string
}

export interface Node extends RedNode<{}> {
  template: string
  minimal: boolean
  output: (msg: object, value: unknown) => void
  originatorEUI: (msg: object) => string | undefined
  targetEUI: (msg: object) => string | undefined
}

export interface TemplateDTO {
  tag: string
  serviceReferenceVariant: ServiceReferenceVariant
  commandVariant: CommandVariant
  info?: string
  gbcs?: string
  gbcsVariant?: string
  gbcsTitle?: string
  matches: Fuse.FuseResultMatch[]
}

export type TemplateLookupDTO = Omit<TemplateDTO, 'matches'>
