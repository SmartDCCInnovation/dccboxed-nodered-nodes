/*
 * Created on Tue Sep 20 2022
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
import type { KeyDefinition, Properties } from '../gbcs-utrn.properties'
import {
  euiValidator,
  settingsHigh as settings,
  typedInputEUI,
} from '../editor-global-settings'

import './gbcs-utrn.css'

import 'jquery-mask-plugin'

declare const RED: EditorRED
declare const $: JQueryStatic

RED.nodes.registerType<Properties & EditorNodeProperties>('gbcs-utrn', {
  ...settings,
  defaults: {
    name: { value: '' },
    server: { value: undefined, type: 'dccboxed-config', required: false },
    keys: {
      value: [],
      required: false,
      validate(val) {
        return (
          (val as unknown as KeyDefinition[])?.every((kd) => {
            return (
              kd.name?.length >= 1 &&
              kd.eui.match(/[0-9a-fA-F]{16}/) != null &&
              ['certificate', 'privateKey'].indexOf(kd.type) >= 0 &&
              kd.usage === 'KA' &&
              kd.content.length >= 1 &&
              kd.prePayment === (kd.type === 'privateKey')
            )
          }) ?? true
        )
      },
    },
    outputUtrn: { value: 'payload.utrn.token', required: true },
    outputCounter: { value: 'payload.utrn.counter', required: true },
    signerEUI: {
      value: '90-B3-D5-1F-30-01-00-00',
      required: true,
      validate: euiValidator(function () {
        return this.signerEUI_type
      }),
    },
    signerEUI_type: { value: 'eui', required: true },
    counter: {
      value: '',
      required: false,
      validate(val) {
        switch (this.counter_type) {
          case 'msg':
            return val.length > 0
          case 'num':
            return val.length > 0 && Number.isInteger(Number(val))
          default:
            return true
        }
      },
    },
    deviceEUI: {
      value: '',
      required: true,
      validate: euiValidator(function () {
        return this.deviceEUI_type
      }),
    },
    deviceEUI_type: { value: 'eui', required: true },
    counter_type: { value: 'epoch', required: true },
    value: {
      value: '1',
      required: true,
      validate(val) {
        if (this.value_type === 'num') {
          return val.length > 0 && Number.isInteger(Number(val))
        } else {
          return val.length > 0
        }
      },
    },
    value_type: { value: 'num', required: true },
    class: {
      value: 'pounds',
      required: true,
      validate(val) {
        if (this.class_type === 'class') {
          return val.match(/^pounds|pennies$/) !== null
        } else {
          return val.length > 0
        }
      },
    },
    class_type: { value: 'class', required: true },
    enableInject: { value: true, required: true },
  },
  inputs: 1,
  outputs: 1,
  outputLabels: 'utrn',
  icon: 'hash.svg',
  label: function () {
    return this.name || 'utrn'
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
        url: `smartdcc/gbcs-utrn/${this.id}`,
        type: 'POST',
        data: JSON.stringify({}),
        contentType: 'application/json; charset=utf-8',
        success: function (resp) {
          RED.notify('Generated UTRN.', {
            type: 'success',
            timeout: 2000,
          })
        },
        error: function (jqXHR, textStatus, errorThrown) {
          if (jqXHR.status == 404) {
            RED.notify(
              RED._('common.notification.error', {
                message: RED._('common.notification.errors.not-deployed'),
              }),
              'error',
            )
          } else if (jqXHR.status == 500) {
            RED.notify(
              RED._('common.notification.error', {
                message: RED._('inject.errors.failed'),
              }),
              'error',
            )
          } else if (jqXHR.status == 0) {
            RED.notify(
              RED._('common.notification.error', {
                message: RED._('common.notification.errors.no-response'),
              }),
              'error',
            )
          } else {
            RED.notify(
              RED._('common.notification.error', {
                message: RED._('common.notification.errors.unexpected', {
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
  oneditprepare() {
    $('#node-input-outputUtrn,#node-input-outputCounter').typedInput({
      default: 'msg',
      types: ['msg'],
    })
    $('#node-input-signerEUI').typedInput({
      default: 'eui',
      types: ['msg', typedInputEUI],
      typeField: $('#node-input-signerEUI_type'),
    })
    $('#node-input-deviceEUI').typedInput({
      default: 'eui',
      types: ['msg', typedInputEUI],
      typeField: $('#node-input-deviceEUI_type'),
    })
    $('#node-input-counter').typedInput({
      default: 'epoch',
      types: [
        'msg',
        'num',
        {
          value: 'epoch',
          hasValue: false,
          label: 'Use Epoch as Counter',
          icon: 'fa fa-clock-o',
        },
      ],
      typeField: $('#node-input-counter_type'),
    })
    $('#node-input-value').typedInput({
      default: 'num',
      types: ['msg', 'num'],
      typeField: $('#node-input-value_type'),
    })
    $('#node-input-class').typedInput({
      default: 'class',
      types: ['msg', { value: 'class', options: ['pennies', 'pounds'] }],
      typeField: $('#node-input-class_type'),
    })

    $('#node-input-key-container').editableList({
      addItem(row, index, data: Partial<KeyDefinition>) {
        const row1 = $('<div/>', {
          class: 'utrn-row form-row',
        }).appendTo(row)
        const row2 = $('<div/>', {
          class: 'utrn-row form-row',
        }).appendTo(row)
        const row3 = $('<div/>', {
          class: 'utrn-row form-row',
        }).appendTo(row)
        const row4 = $('<div/>', {
          class: 'utrn-row form-row',
        }).appendTo(row)

        $('<label/>')
          .attr('for', `node-input-key-name-${index}`)
          .html('<i class="fa fa-tag"></i> Name')
          .appendTo(row1)
        $('<input/>', { class: 'utrn-single-input' })
          .attr('type', 'text')
          .attr('id', `node-input-key-name-${index}`)
          .attr('placeholder', 'My Device KA Certificate')
          .prop('required', true)
          .val(data?.name ?? '')
          .appendTo(row1)

        $('<label/>')
          .attr('for', `node-input-key-eui-${index}`)
          .html('<i class="fa fa-tag"></i> EUI')
          .appendTo(row2)
        $('<input/>', { class: 'utrn-single-input' })
          .attr('type', 'text')
          .attr('id', `node-input-key-eui-${index}`)
          .attr('placeholder', '00-DB-12-34-56-78-90-A0')
          .mask('hh-hh-hh-hh-hh-hh-hh-hh', {
            translation: { h: { pattern: /[0-9a-fA-F]/ } },
          })
          .prop('required', true)
          .attr('pattern', '^.{23}$')
          .val(data?.eui?.replace(/(.{2})(?!$)/g, '$1-') ?? '')
          .appendTo(row2)

        $('<label/>')
          .attr('for', `node-input-key-type-${index}`)
          .html('<i class="fa fa-tag"></i> Type')
          .appendTo(row3)
        const typeField = $('<select/>', { class: 'utrn-single-input' })
          .attr('id', `node-input-key-type-${index}`)
          .val(data?.type ?? 'certificate')
          .appendTo(row3)
        ;[
          { val: 'certificate', text: 'Device KA X509 Certificate (PEM)' },
          { val: 'privateKey', text: 'Supplier KA PP PKCS8 Private Key (PEM)' },
        ].forEach(({ val, text }) =>
          $('<option></option>').val(val).text(text).appendTo(typeField),
        )

        $('<label/>')
          .attr('for', `node-input-key-content-${index}`)
          .html('<i class="fa fa-key"></i> Content')
          .appendTo(row4)
        $('<textarea/>', { class: 'utrn-single-input' })
          .attr('id', `node-input-key-content-${index}`)
          .attr(
            'placeholder',
            '-----BEGIN PRIVATE KEY-----\nMIIBrDCCAVKgAwIBAg...',
          )
          .prop('required', true)
          .val(data?.content ?? '')
          .appendTo(row4)
        $('#node-input-key-container')
          .parent()
          .height((row.height() ?? 200) + 16)
      },
      removeItem(data) {
        if ($('#node-input-key-container').editableList('length') === 0) {
          $('#node-input-key-container').parent().height(20)
        }
      },
      removable: true,
      sortable: true,
      sort(
        itemA: Partial<KeyDefinition>,
        itemB: Partial<KeyDefinition>,
      ): number {
        return (itemA?.name ?? '').localeCompare(itemB?.name ?? '')
      },
    })
    this.keys?.forEach((keyDef) =>
      $('#node-input-key-container').editableList('addItem', keyDef),
    )
  },
  oneditsave(this) {
    const node = this
    this.keys = []
    $('#node-input-key-container')
      .editableList('items')
      .each(function () {
        const itemRoot = $(this)
        const keyDef: KeyDefinition = {
          name: itemRoot.find('[id^=node-input-key-name]').val() as string,
          eui: (
            itemRoot.find('[id^=node-input-key-eui]').val() as string
          ).replace(/-/g, ''),
          type: itemRoot.find('[id^=node-input-key-type]').val() as
            | 'certificate'
            | 'privateKey',
          usage: 'KA',
          content: itemRoot
            .find('[id^=node-input-key-content]')
            .val() as string,
          prePayment:
            itemRoot.find('[id^=node-input-key-type]').val() === 'privateKey',
        }
        node.keys.push(keyDef)
      })
    const msgs = $('input[type=hidden][id^=node-input][id$=_type]')
      .map((i, e) => $(e).val() === 'msg')
      .get()
    this.enableInject = msgs.every((b) => b === false)
  },
})
