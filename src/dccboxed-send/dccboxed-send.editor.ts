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

import type { EditorRED, EditorNodeProperties } from 'node-red'
import type { Properties } from '../dccboxed-send.properties'

declare const RED: EditorRED
declare const $: JQueryStatic

RED.nodes.registerType<Properties & EditorNodeProperties>('dccboxed-send', {
  category: 'smartdcc',
  color: '#a300cc',
  defaults: {
    name: { value: '' },
    server: { value: '', type: 'dccboxed-config' },
    input: { value: 'payload.request', required: true },
    output: { value: 'payload.response', required: true },
  },
  inputs: 1,
  inputLabels(this) {
    return 'simplified duis'
  },
  outputs: 3,
  outputLabels(this, idx) {
    if (idx === 0) {
      return 'I0 (non-device success)'
    }
    if (idx === 1) {
      return 'I99 (acknowledgement)'
    }
    return 'Error'
  },
  icon: 'arrow-in.svg',
  label: function () {
    return this.name || 'dccboxed-send'
  },
  oneditprepare() {
    $('#node-input-input,#node-input-output').typedInput({
      default: 'msg',
      types: ['msg'],
    })
  },
})
