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
import type { KeyDefinition, Properties } from '../gbcs-signer.properties'
import './gbcs-signer.css'

import 'jquery-mask-plugin'

declare const RED: EditorRED
declare const $: JQueryStatic

RED.nodes.registerType<Properties & EditorNodeProperties>('gbcs-signer', {
  category: 'smartdcc',
  color: '#a300cc',
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
              ['DS', 'KA'].indexOf(kd.usage) >= 0 &&
              kd.content.length >= 1
            )
          }) ?? true
        )
      },
    },
    precommand: { value: 'payload.precommand', required: true },
    signedprecommand: { value: 'payload.signedprecommand', required: true },
    signerEUI: { value: 'payload.signer', required: true },
    signerEUI_type: { value: 'msg', required: true },
  },
  inputs: 1,
  inputLabels: 'gbcs',
  outputs: 1,
  outputLabels(this, idx) {
    if (idx === 0) {
      return 'success'
    } else {
      return 'error'
    }
  },
  icon: 'envelope.svg',
  label: function () {
    return this.name || 'gbcs-signer'
  },
  oneditprepare() {
    $('#node-input-precommand').typedInput({
      default: 'msg',
      types: ['msg'],
    })
    $('#node-input-signedprecommand').typedInput({
      default: 'msg',
      types: ['msg'],
    })
    $('#node-input-signerEUI').typedInput({
      default: 'msg',
      types: [
        'msg',
        {
          value: 'eui',
          label: 'EUI',
          validate: /^([0-9a-fA-F]{2}([- ](?!$))?){8}$/,
        },
      ],
      typeField: $('#node-input-signerEUI_type'),
    })
    $('#node-input-key-container').editableList({
      addItem(row, index, data: Partial<KeyDefinition>) {
        const row1 = $('<div/>', {
          class: 'gbcs-signer-row form-row',
        }).appendTo(row)
        const row2 = $('<div/>', {
          class: 'gbcs-signer-row form-row',
        }).appendTo(row)
        const row3 = $('<div/>', {
          class: 'gbcs-signer-row form-row',
        }).appendTo(row)
        const row4 = $('<div/>', {
          class: 'gbcs-signer-row form-row',
        }).appendTo(row)

        $('<label/>')
          .attr('for', `node-input-key-name-${index}`)
          .html('<i class="fa fa-tag"></i> Name')
          .appendTo(row1)
        $('<input/>', { class: 'gbcs-signer-single-input' })
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
        $('<input/>', { class: 'gbcs-signer-single-input' })
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

        const typeField = $('<select/>', {
          class: 'g1',
        })
          .attr('id', `node-input-key-type-${index}`)
          .val(data?.type ?? 'certificate')
          .appendTo(row3)
        ;[
          // remove the certificate option as signer only needs private keys
          //  { val: 'certificate', text: 'X509 Certificate (PEM)' },
          { val: 'privateKey', text: 'PKCS8 Private Key (PEM)' },
        ].forEach(({ val, text }) =>
          $('<option></option>').val(val).text(text).appendTo(typeField)
        )
        const usageField = $('<select/>', {
          class: 'g1',
        })
          .attr('id', `node-input-key-usage-${index}`)
          .val(data?.usage ?? 'DS')
          .appendTo(row3)
        ;[
          { val: 'DS', text: 'Digital Signature' },
          { val: 'KA', text: 'Key Agreement' },
        ].forEach(({ val, text }) =>
          $('<option></option>').val(val).text(text).appendTo(usageField)
        )

        $('<label/>')
          .attr('for', `node-input-key-content-${index}`)
          .html('<i class="fa fa-key"></i> Content')
          .appendTo(row4)
        $('<textarea/>', { class: 'gbcs-signer-single-input' })
          .attr('id', `node-input-key-content-${index}`)
          .attr(
            'placeholder',
            '-----BEGIN PRIVATE KEY-----\nMIIBrDCCAVKgAwIBAg...'
          )
          .prop('required', true)
          .val(data?.content ?? '')
          .appendTo(row4)
      },
      removable: true,
      sortable: true,
      sort(
        itemA: Partial<KeyDefinition>,
        itemB: Partial<KeyDefinition>
      ): number {
        return (itemA?.name ?? '').localeCompare(itemB?.name ?? '')
      },
    })
    this.keys?.forEach((keyDef) =>
      $('#node-input-key-container').editableList('addItem', keyDef)
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
          usage: itemRoot.find('[id^=node-input-key-usage]').val() as
            | 'DS'
            | 'KA',
          content: itemRoot
            .find('[id^=node-input-key-content]')
            .val() as string,
        }
        node.keys.push(keyDef)
      })
  },
})
