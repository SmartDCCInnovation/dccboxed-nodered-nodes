/*
 * Created on Mon Sep 12 2022
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

import { EditorWidgetTypedInputTypeDefinition } from 'node-red'

/**
 * default values to be used for nodes in editor
 */
export const settingsHigh = {
  color: '#f0b3ff',
  category: 'smartdcc',
}

export const settingsLow = {
  color: '#bbb3ff',
  category: 'smartdcc lowlevel',
}

/**
 * defines a EUI with/without hyphens and spaces
 */
const euiRegex = /^([0-9a-fA-F]{2}([- ](?!$))?){8}$/

/**
 * Used in a node-red validator for a typedInput that expects a EUI
 *
 * @param selector looks up the type of a typeInput
 * @returns
 */
export function euiValidator<T>(selector: (this: T) => true | 'msg' | 'eui') {
  return function (this: T, val: string): boolean {
    switch (selector.call(this)) {
      case true:
        return true
      case 'msg':
        return val.length > 0
      case 'eui':
        return val.match(euiRegex) !== null
    }
  }
}

/**
 * passed into a typedInput to add an eui as an option
 */
export const typedInputEUI: EditorWidgetTypedInputTypeDefinition = {
  value: 'eui',
  label: 'EUI',
  validate: euiRegex,
}
