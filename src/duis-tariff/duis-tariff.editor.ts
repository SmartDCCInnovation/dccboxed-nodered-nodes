/*
 * Created on Thu Aug 17 2023
 *
 * Copyright (c) 2023 Smart DCC Limited
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
  EditorNodeInstance,
  EditorRED,
  EditorNodeProperties,
} from 'node-red'
import type { Properties } from '../duis-tariff.properties'
import {
  euiValidator,
  settingsHigh as settings,
  typedInputEUI,
} from '../editor-global-settings'
import { examples } from './duis-tariff-examples'

import './duis-tariff.css'
import type { Tariff } from '@smartdcc/duis-templates'

/*
 do not directly import from @smartdcc/duis-templates as webpack will bring in
 whole module and fail to build.
 */
import { isValidTariff } from '@smartdcc/duis-templates/dist/tariff.is'

declare const RED: EditorRED
declare const $: JQueryStatic

/* definitional equality */
function defEquality(raw: string, data: Tariff): boolean {
  try {
    return JSON.stringify(JSON.parse(raw)) === JSON.stringify(data)
  } catch (e) {
    return false
  }
}

type ENT = Properties &
  EditorNodeProperties & {
    editor?: AceAjax.Editor
    tariffBodyOriginal?: Tariff
  }

function resizeConfigPane(this: EditorNodeInstance<ENT>) {
  const rows = $('#dialog-form>div:not(.node-text-editor-row)')
  let height = $('#dialog-form').height() ?? 0
  for (const row of rows) {
    height = height - ($(row).outerHeight(true) ?? 0)
  }
  const editorRow = $('#dialog-form>div.node-text-editor-row')
  height -=
    parseInt(editorRow.css('marginTop')) +
    parseInt(editorRow.css('marginBottom'))
  $('.node-text-editor').css('height', height + 'px')
  this.editor?.resize()
}

RED.nodes.registerType<ENT>('duis-tariff', {
  ...settings,
  defaults: {
    name: { value: undefined, required: false },
    deafultName: { value: undefined, required: false },
    input: {
      value: 'payload.tariff',
      required: false,
      validate(v) {
        if (this.input_type === 'msg') {
          return RED.utils.validatePropertyExpression(v)
        }
        return true
      },
    },
    input_type: { value: 'msg', required: true },
    output: { value: 'payload.request', required: false },
    originatorEUI: {
      value: '90-B3-D5-1F-30-01-00-00' /* Supplier 1 */,
      validate(v) {
        if (this.originatorEUI_type === 'msg' && this.inputs === 0) {
          return false
        }

        return euiValidator<EditorNodeInstance<ENT>>(function () {
          return this.originatorEUI_type
        }).call(this, v)
      },
    },
    originatorEUI_type: { value: 'eui', required: true },
    targetEUI: {
      value: undefined,
      validate(v) {
        if (this.targetEUI_type === 'msg' && this.inputs === 0) {
          return false
        }

        return euiValidator<EditorNodeInstance<ENT>>(function () {
          return this.targetEUI_type
        }).call(this, v)
      },
    },
    targetEUI_type: { value: 'eui', required: true },
    tariffBody: {
      value: undefined,
      validate(val) {
        if (this.input_type === 'msg') {
          return true
        }
        if (val.trim() === '') {
          return true
        }
        try {
          return Boolean(isValidTariff(JSON.parse(val)))
        } catch (e) {
          if (e instanceof SyntaxError) {
            return false
          }
          throw e
        }
      },
    },
  },
  inputs: 1,
  outputs: 1,
  icon: 'template.svg',
  label: function () {
    return this.name || this.deafultName || 'duis-tariff'
  },
  button: {
    enabled() {
      return (
        this.input_type === 'example' &&
        this.originatorEUI_type !== 'msg' &&
        this.targetEUI_type !== 'msg'
      )
    },
    visible() {
      return (
        this.input_type === 'example' &&
        this.originatorEUI_type !== 'msg' &&
        this.targetEUI_type !== 'msg'
      )
    },
    onclick(this: EditorNodeInstance<Properties & EditorNodeProperties>) {
      $.ajax({
        url: `smartdcc/duis-tariff/${this.id}`,
        type: 'POST',
        data: JSON.stringify({}),
        contentType: 'application/json; charset=utf-8',
        success: function (resp) {
          RED.notify('Generated tariff.', {
            type: 'success',
            timeout: 2000,
          })
        },
        error: function (jqXHR, textStatus, errorThrown) {
          if (jqXHR.status == 404) {
            RED.notify(
              this._('common.notification.error', {
                message: this._('common.notification.errors.not-deployed'),
              }),
              'error',
            )
          } else if (jqXHR.status == 500) {
            RED.notify(
              this._('common.notification.error', {
                message: this._('inject.errors.failed'),
              }),
              'error',
            )
          } else if (jqXHR.status == 0) {
            RED.notify(
              this._('common.notification.error', {
                message: this._('common.notification.errors.no-response'),
              }),
              'error',
            )
          } else {
            RED.notify(
              this._('common.notification.error', {
                message: this._('common.notification.errors.unexpected', {
                  status: jqXHR.status,
                  message: textStatus,
                }),
              }),
              'error',
            )
          }
        },
      })
    },
  },
  oneditprepare(this) {
    const node = this
    let firstLoad = true

    $('#node-input-input')
      .typedInput({
        default: 'msg',
        types: [
          'msg',
          {
            value: 'example',
            label: 'Example',
            options: Object.keys(examples),
          },
        ],
        typeField: $('#node-input-input_type'),
      })
      .on('change', (event, type, value) => {
        if (type === 'msg') {
          $('.duis-tariff-tariffBody-container').addClass('duis-tariff-hidden')
        } else {
          $('.duis-tariff-tariffBody-container').removeClass(
            'duis-tariff-hidden',
          )

          if (this.editor && value in examples) {
            this.tariffBodyOriginal = examples[value]
            if (
              !firstLoad ||
              (firstLoad && this.editor.getValue().trim() === '')
            ) {
              this.editor.setValue(JSON.stringify(examples[value], null, 4))
            }
            firstLoad = false
            resizeConfigPane.call(this)
          }
        }
      })
    $('#node-input-output').typedInput({
      default: 'msg',
      types: ['msg'],
    })
    ;['originator', 'target'].forEach((s) => {
      $(`#node-input-${s}EUI`).typedInput({
        default: 'eui',
        types: ['msg', typedInputEUI, 'flow', 'global'],
        typeField: $(`#node-input-${s}EUI_type`),
      })
    })

    if (($('#node-input-tariffBody').val() as string).trim() !== '') {
      $('.duis-tariff-edited').show()
    } else {
      $('.duis-tariff-edited').hide()
    }
    this.editor = RED.editor.createEditor({
      id: 'node-input-tariffBody-editor',
      mode: 'ace/mode/json',
      value: ($('#node-input-tariffBody').val() as string) ?? '',
    })
    this.editor.on('change', () => {
      if (this.editor && this.tariffBodyOriginal) {
        if (defEquality(this.editor.getValue(), this.tariffBodyOriginal)) {
          $('.duis-tariff-edited').hide()
        } else {
          $('.duis-tariff-edited').show()
        }
      } else {
        $('.duis-tariff-edited').hide()
      }
      if (this.editor) {
        try {
          if (isValidTariff(JSON.parse(this.editor.getValue()))) {
            $('.duis-tariff-invalid').hide()
          } else {
            $('.duis-tariff-invalid').show()
          }
        } catch {
          $('.duis-tariff-invalid').show()
        }
      }
    })
  },
  oneditsave: function () {
    if (this.editor) {
      if (
        (this.tariffBodyOriginal !== undefined &&
          defEquality(this.editor.getValue(), this.tariffBodyOriginal)) ||
        $('#node-input-minimal').is(':not(:checked)')
      ) {
        $('#node-input-tariffBody').val('')
      } else {
        $('#node-input-tariffBody').val(this.editor.getValue().trim())
      }
    }
    this.editor?.destroy()
    delete this.editor
  },
  oneditcancel: function () {
    this.editor?.destroy()
    delete this.editor
  },
  oneditresize: resizeConfigPane,
})
