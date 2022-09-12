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
import { settings } from '../editor-global-settings'

declare const RED: EditorRED
declare const $: JQueryStatic

RED.nodes.registerType<Properties & EditorNodeProperties>('dccboxed-receive', {
  ...settings,
  defaults: {
    name: { value: '' },
    server: { value: '', type: 'dccboxed-config', required: true },
    output: { value: 'payload.response', required: true },
    decodeGbcs: { value: true, required: true },
    gbcsOutput: { value: 'payload.gbcs', required: true },
    outputResponsesFilter: { value: undefined, required: false },
    outputDeviceAlertsFilter: { value: undefined, required: false },
    outputDCCAlertsFilter: { value: undefined, required: false },
    outputResponsesFilterType: { value: 'all', required: false },
    outputDeviceAlertsFilterType: { value: 'all', required: false },
    outputDCCAlertsFilterType: { value: 'all', required: false },
    outputs: { value: 4 },
  },
  inputs: 0,
  outputs: 4,
  outputLabels(idx: number) {
    const labels: string[] = []
    if (this.outputResponsesFilterType !== 'none') {
      labels.push('I0 (response)')
    }
    if (this.outputDeviceAlertsFilterType !== 'none') {
      labels.push('I0 (device alert)')
    }
    if (this.outputDCCAlertsFilterType !== 'none') {
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
      console.log('change')
      $('input#node-input-outputs').val(
        JSON.stringify(
          1 +
            $(
              'input[type=hidden][id^=node-input-output][id$=FilterType]:not([value=none])'
            ).length
        )
      )
    }
    $('input[type=text][id^=node-input-output][id$=Filter]').each(
      (index, element) => {
        const el = $(element)
        el.typedInput({
          types: [
            're',
            {
              value: 'list',
              hasValue: true,
              label: 'Comma Separated Strings',
              icon: 'fa fa-ellipsis-h',
            },
            {
              value: 'none',
              hasValue: false,
              label: 'Hide Output (No Messages)',
              icon: 'fa fa-ban',
            },
            {
              value: 'all',
              hasValue: false,
              label: 'All Messages (No Filter)',
              icon: 'fa fa-check',
            },
          ],
          typeField: `#${el.attr('id')}Type`,
        }).on('change', setOutputs)
      }
    )
  },
})
