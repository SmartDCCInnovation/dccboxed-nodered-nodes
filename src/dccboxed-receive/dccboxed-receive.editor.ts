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
import type { Properties } from '../dccboxed-receive.properties'

declare const RED: EditorRED
declare const $: JQueryStatic

RED.nodes.registerType<Properties & EditorNodeProperties>('dccboxed-receive', {
  category: 'smartdcc',
  color: '#a300cc',
  defaults: {
    name: { value: '' },
    server: { value: '', type: 'dccboxed-config', required: true },
    output: { value: 'payload.response', required: true },
    decodeGbcs: { value: true, required: true },
    gbcsOutput: { value: 'payload.gbcs', required: true },
  },
  inputs: 0,
  outputs: 4,
  outputLabels(idx: number) {
    switch (idx) {
      case 0:
        return 'I0 (response)'
      case 1:
        return 'I0 (device alert)'
      case 2:
        return 'I0 (dcc alert)'
      default:
        return 'Error'
    }
  },
  icon: 'arrow-in.svg',
  label: function () {
    return this.name || 'dccboxed-receive'
  },
  oneditprepare() {
    $('#node-input-output,#node-input-gbcsOutput').typedInput({
      default: 'msg',
      types: ['msg'],
    })
    $('#node-input-decodeGbcs').on('change', function () {
      if ($(this).is(':checked')) {
        $('#dccboxed-receive-gbcsOutput').show()
      } else {
        $('#dccboxed-receive-gbcsOutput').hide()
      }
    })
  },
})
