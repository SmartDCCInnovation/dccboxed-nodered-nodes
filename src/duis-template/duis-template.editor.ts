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
  EditorNodeInstance,
  EditorRED,
  EditorNodeProperties,
} from 'node-red'
import type {
  Properties,
  TemplateDTO,
  TemplateLookupDTO,
} from '../duis-template.properties'
import {
  euiValidator,
  settingsHigh as settings,
  typedInputEUI,
} from '../editor-global-settings'

import './duis-template.css'

declare const RED: EditorRED
declare const $: JQueryStatic

function renderAttribute(template: TemplateDTO, attribute: string): JQuery {
  const a = attribute
    .split('.')
    .reduce((p, c) => (p as any)?.[c], template) as unknown
  if (typeof a !== 'string') {
    return $('<span/>').addClass('duis-template-error').text('bad data')
  }
  const match = template.matches.find(({ key }) => key === attribute)
  if (!match) {
    return $('<span/>')
      .addClass('duis-template-no-match')
      .text(a || 'n/a')
  }
  const result = $('<div/>').addClass('duis-template-inline')
  let current = 0
  for (const index of match.indices) {
    result.append(
      $('<span/>')
        .addClass('duis-template-no-match')
        .text(a.slice(current, index[0]))
    )
    result.append(
      $('<span/>')
        .addClass('duis-template-match')
        .text(a.slice(index[0], index[1] + 1))
    )
    current = index[1] + 1
  }
  result.append(
    $('<span/>').addClass('duis-template-no-match').text(a.slice(current))
  )
  return result
}

function renderTemplateDTO(template: TemplateDTO): JQuery {
  const root = $('<div/>').addClass('duis-template-search-result')
  const row1 = $('<div/>').addClass('duis-template-duis')

  row1.append(
    renderAttribute(
      template,
      'serviceReferenceVariant.Service Reference Variant'
    )
  )
  row1.append(
    renderAttribute(template, 'serviceReferenceVariant.Service Request Name')
  )

  if (template.info) {
    row1.append(
      $('<div/>')
        .addClass('duis-template-inline duis-template-duis-variant')
        .append(
          $('<span/>').addClass('duis-template-no-match').text('['),
          renderAttribute(template, 'info'),
          $('<span/>').addClass('duis-template-no-match').text(']')
        )
    )
  }

  root.append(row1)

  if (template.gbcs) {
    const row2 = $('<div/>').addClass('duis-template-gbcs')
    row2.append(renderAttribute(template, 'gbcsTitle'))

    if (template.gbcsVariant) {
      row2.append(
        $('<div/>')
          .addClass('duis-template-inline')
          .append(
            $('<span/>').addClass('duis-template-no-match').text('['),
            renderAttribute(template, 'gbcsVariant'),
            $('<span/>').addClass('duis-template-no-match').text(']')
          )
      )
    }

    root.append(row2)
  }

  return root
}

RED.nodes.registerType<Properties & EditorNodeProperties>('duis-template', {
  ...settings,
  defaults: {
    name: { value: undefined, required: false },
    deafultName: { value: undefined, required: false },
    template: {
      value: '',
      required: true,
      validate(this, val) {
        return this.templateValid === 'true'
      },
    },
    templateValid: {
      value: 'false',
      required: true,
      validate: RED.validators.regex(/true|false/),
    },
    minimal: { value: true, required: true },
    output: { value: 'payload.request', required: false },
    enableInject: { value: true, required: true },
    originatorEUI: {
      value: undefined,
      validate: euiValidator(function () {
        if (!this.minimal || this.originatorEUI_type === 'default') {
          return true
        }
        return this.originatorEUI_type
      }),
    },
    originatorEUI_type: { value: 'default', required: true },
    targetEUI: {
      value: undefined,
      validate: euiValidator(function () {
        if (!this.minimal || this.targetEUI_type === 'default') {
          return true
        }
        return this.targetEUI_type
      }),
    },
    targetEUI_type: { value: 'default', required: true },
  },
  inputs: 1,
  outputs: 1,
  icon: 'template.svg',
  label: function () {
    return this.name || this.deafultName || 'duis-template'
  },
  button: {
    enabled() {
      return this.enableInject
    },
    visible() {
      return this.enableInject
    },
    onclick(this: EditorNodeInstance<Properties & EditorNodeProperties>) {
      $.ajax({
        url: `smartdcc/duis-template/${this.id}`,
        type: 'POST',
        data: JSON.stringify({}),
        contentType: 'application/json; charset=utf-8',
        success: function (resp) {
          RED.notify('Generated DUIS template.', {
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
              'error'
            )
          } else if (jqXHR.status == 500) {
            RED.notify(
              this._('common.notification.error', {
                message: this._('inject.errors.failed'),
              }),
              'error'
            )
          } else if (jqXHR.status == 0) {
            RED.notify(
              this._('common.notification.error', {
                message: this._('common.notification.errors.no-response'),
              }),
              'error'
            )
          } else {
            RED.notify(
              this._('common.notification.error', {
                message: this._('common.notification.errors.unexpected', {
                  status: jqXHR.status,
                  message: textStatus,
                }),
              }),
              'error'
            )
          }
        },
      })
    },
  },
  oneditprepare(this) {
    const node = this
    $('#node-input-output').typedInput({
      default: 'msg',
      types: ['msg'],
    })
    ;['originator', 'target'].forEach((s) => {
      $(`#node-input-${s}EUI`).typedInput({
        default: 'default',
        types: [
          'msg',
          typedInputEUI,
          {
            value: 'default',
            label: 'N/A',
            hasValue: false,
          },
        ],
        typeField: $(`#node-input-${s}EUI_type`),
      })
    })
    $('#node-input-minimal').on('change', function () {
      if ($(this).is(':checked')) {
        $('.duis-template-optional').show()
      } else {
        $('.duis-template-optional').hide()
      }
    })

    $('#node-input-template')
      .typedInput({
        types: [
          {
            value: 'template',
            label: 'RTDS',
            icon: 'fa fa-file-code-o',
            validate() {
              return $('input#node-input-templateValid').val() === 'true'
            },
            autoComplete(
              value: string,
              done: (
                options: { value: string; label: string | JQuery }[]
              ) => void
            ): void {
              $.ajax({
                url: 'smartdcc/duis-template/search',
                dataType: 'json',
                data: { q: value },
                timeout: 250,
                success(data: TemplateDTO[]) {
                  if (!Array.isArray(data)) {
                    RED.notify('failed to search templates', {
                      timeout: 5,
                      type: 'error',
                    })
                    done([])
                    return
                  }
                  done(
                    data.map((template) => {
                      return {
                        value: template.tag,
                        label: renderTemplateDTO(template),
                      }
                    })
                  )
                },
                error(e, textStatus) {
                  if (textStatus !== 'timeout') {
                    console.error(e)
                  }
                  done([])
                },
              })
            },
          } as any,
        ],
      })
      .on('change', function () {
        $('input#node-input-templateValid').val('false').trigger('change')
        $('#duis-template-card-serviceRequestName>span').text('loading...')
        $('.duis-template-card-toggle').hide()
        $.ajax({
          url: `smartdcc/duis-template/lookup/${$(this).val()}`,
          dataType: 'json',
          timeout: 250,
          success(data: TemplateLookupDTO) {
            $('input#node-input-templateValid').val('true').trigger('change')
            $('.duis-template-card-toggle').show()
            $('#duis-template-card-serviceRequestName>span').text(
              `${data.serviceReferenceVariant['Service Reference Variant']} - ${data.serviceReferenceVariant['Service Request Name']}`
            )
            node.deafultName = `${
              data.serviceReferenceVariant['Service Reference Variant']
            }${data.gbcs ? ` - ${data.gbcs}` : ''}`
            if (data.info) {
              $('#duis-template-card-serviceRequestName-variant>span').text(
                data.info.replace(/_/g, ' ').toLocaleLowerCase()
              )
              $('#duis-template-card-serviceRequestName-variant').show()
            } else {
              $('#duis-template-card-serviceRequestName-variant').hide()
            }
            $('#duis-template-card-serviceRequestName-critical>span').text(
              data.serviceReferenceVariant.Critical
            )
            $('#duis-template-card-serviceRequestName-nondevice>span').text(
              data.serviceReferenceVariant['Non-Device Request']
            )
            $('#duis-template-card-serviceRequestName-cv>span').text(
              `${data.commandVariant.number} - ${data.commandVariant.description}`
            )
            if (data.gbcsTitle) {
              $('#duis-template-card-gbcsName>span').text(data.gbcsTitle)
              $('#duis-template-card-gbcsName').show()
              if (data.gbcsVariant) {
                $('#duis-template-card-gbcsName-variant>span').text(
                  data.gbcsVariant
                )
                $('#duis-template-card-gbcsName-variant').show()
              } else {
                $('#duis-template-card-gbcsName-variant').hide()
              }
            } else {
              $(
                '#duis-template-card-gbcsName,#duis-template-card-gbcsName-variant'
              ).hide()
            }
          },
          error(e, textStatus) {
            if (textStatus !== 'timeout' && e.status !== 404) {
              console.error(e)
              $('#duis-template-card-serviceRequestName>span').text(
                `failed to load - ${e.statusText}`
              )
            } else {
              $('#duis-template-card-serviceRequestName>span').text(
                e.status === 404 ? 'not found' : 'failed to load'
              )
            }
          },
        })
      })

    $('input#node-input-templateValid').on('change', function () {
      $('#node-input-template').typedInput('validate')
    })
  },
})
