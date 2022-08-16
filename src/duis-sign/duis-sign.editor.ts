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
  EditorRED,
  EditorNodeProperties,
  EditorNodeInstance,
} from 'node-red'
import { Properties } from '../duis-sign.properties'

declare const RED: EditorRED

RED.nodes.registerType<Properties & EditorNodeProperties>('duis-sign', {
  category: 'smartdcc',
  color: '#a300cc',
  defaults: {
    name: { value: '' },
    mode: {
      value: 'sign',
      required: true,
      validate: (v) => v === 'sign' || v === 'validate',
    },
    preserveCounter: { value: false, required: true },
    input: { value: 'payload.request', required: false },
    output: { value: 'payload.request', required: false },
  },
  inputs: 1,
  inputLabels: 'xml string',
  outputs: 1,
  outputLabels: 'xml string',
  icon: 'envelope.svg',
  paletteLabel: 'duis - sign & validate',
  label: function (
    this: EditorNodeInstance<Properties & EditorNodeProperties>
  ) {
    return this.name || `duis-${this.mode}`
  },
  oneditprepare() {
    $('#node-input-mode').on('change', function () {
      $('.duis-sign-preserveCounter').css(
        'visibility',
        $(this).val() === 'sign' ? 'visible' : 'hidden'
      )
    })
    $('#node-input-input,#node-input-output').typedInput({
      default: 'msg',
      types: ['msg'],
    })
  },
})
