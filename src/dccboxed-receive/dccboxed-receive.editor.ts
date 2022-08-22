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
    outputResponses: { value: true, required: true },
    outputDeviceAlerts: { value: true, required: true },
    outputDCCAlerts: { value: true, required: true },
    outputResponsesFilter: { value: undefined, required: false },
    outputDeviceAlertsFilter: { value: undefined, required: false },
    outputDCCAlertsFilter: { value: undefined, required: false },
    outputs: { value: 4 },
  },
  inputs: 0,
  outputs: 4,
  outputLabels(idx: number) {
    const labels: string[] = []
    if (this.outputResponses) {
      labels.push('I0 (response)')
    }
    if (this.outputDeviceAlerts) {
      labels.push('I0 (device alert)')
    }
    if (this.outputDCCAlerts) {
      labels.push('I0 (dcc alert)')
    }
    labels.push('Error')
    return labels[idx]
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
    const setOutputs = () => {
      $('input#node-input-outputs').val(
        JSON.stringify(
          1 + $('input[type=checkbox][id^=node-input-output]:checked').length
        )
      )
    }
    $('input[type=checkbox][id^=node-input-output]').on('change', setOutputs)
    $('input[type=checkbox][id^=node-input-output]').on('change', function () {
      const input = $(this)
      if (input.is(':checked')) {
        $(`div.${input.attr('id')}`).show()
      } else {
        $(`div.${input.attr('id')}`).hide()
      }
    })
    $('input[type=text][id^=node-input-output][id$=Filter]').typedInput({
      types: ['re'],
    })
  },
})
