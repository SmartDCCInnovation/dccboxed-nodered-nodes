/*
 * Created on Tue Aug 16 2022
 *
 * Copyright (c) 2025 Smart DCC Limited
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
import type {
  HeaderDef,
  Headers,
  Properties,
  WSMessageDTO,
} from '../dccboxed-config.properties'

import './dccboxed-config.css'

declare const RED: EditorRED

/**
 * global called from palette node every time a node is added
 * @param node
 */
function addHandler(
  node: EditorNodeInstance<Properties & EditorNodeProperties>,
): void {
  if (node.type === 'dccboxed-config') {
    wsHandlers[node.id] = wsHandler
    RED.comms.subscribe(`smartdcc/config/${node.id}/#`, wsHandlers[node.id])
  }
}

/**
 * global called from palette node every time a node is removed
 * @param node
 */
function removeHandler(
  node: EditorNodeInstance<Properties & EditorNodeProperties>,
): void {
  if (node.type === 'dccboxed-config') {
    if (node.id in wsHandlers) {
      RED.comms.unsubscribe(`smartdcc/config/${node.id}/#`, wsHandlers[node.id])
      delete wsHandlers[node.id]
    }
  }
}

type WSHandlerCallback<T> = (topic: string, data: T) => void

const wsHandlers: { [k: string]: WSHandlerCallback<WSMessageDTO> } = {}

const wsHandler: WSHandlerCallback<WSMessageDTO> = (topic, data) => {
  const config = RED.nodes.node(data.id) as EditorNodeInstance
  if (!config) {
    return
  }
  const source = RED.nodes.node(data.sourceNode) as EditorNodeInstance
  switch (data.kind) {
    case 'notification':
      console.log(source)
      RED.notify(`${source.name ? `${source.name}: ` : ''}${data.message}`, {
        type: data.type,
        timeout: data.timeout,
      })
      return
  }
}

function isConfigNode(
  o: Object,
): o is Properties & { type: 'dccboxed-config'; id: string } {
  const x = <Properties & { type: 'dccboxed-config'; id: string }>o
  return (
    typeof o === 'object' &&
    o !== null &&
    x.type === 'dccboxed-config' &&
    typeof x.id === 'string' &&
    typeof x.host === 'string' &&
    (typeof x.localKeyStore === 'string' ||
      typeof x.localKeyStore === 'undefined') &&
    (typeof x.logger === 'string' || typeof x.logger === 'undefined') &&
    typeof x.loggerType === 'string' &&
    typeof x.port === 'string' &&
    RED.validators.number()(x.port) &&
    typeof x.responseEndpoint === 'string'
  )
}

RED.nodes.registerType<Properties & EditorNodeProperties>('dccboxed-config', {
  category: 'config',
  defaults: {
    host: {
      value: '1.2.3.4',
      required: true,
      validate: RED.validators.regex(
        /(?=^.{4,253}$)^((((?!-)[a-zA-Z0-9-]{1,63}(?<!-)\.)+[a-zA-Z]{2,63})|(((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}))$/,
      ),
    },
    port: {
      value: '8079',
      required: false,
      validate: RED.validators.number(true),
    },
    smkiPort: {
      value: '8083',
      required: false,
      validate: RED.validators.number(true),
    },
    duisTls: { value: false, required: true },
    smkiTls: { value: false, required: true },
    responseEndpoint: {
      value: '/smartdcc/duis',
      required: true,
      validate(val) {
        if (RED.validators.regex(/^\/smartdcc\/[a-zA-Z0-9]+/)(val)) {
          let unique = true
          RED.nodes.eachConfig((conf) => {
            if (isConfigNode(conf) && this.id !== conf.id) {
              unique = unique && conf.responseEndpoint !== val
            }
            return true
          })
          return unique
        }
        return false
      },
    },
    localKeyStore: {
      value: undefined,
      required: false,
    },
    logger: { value: undefined },
    loggerType: { value: 'stdout', required: true },
    duisHeaders: { value: {}, required: false },
    smkiHeaders: { value: {}, required: false },
  },
  label: function () {
    if (typeof this.name === 'string' && this.name !== '') {
      return this.name
    }

    let name = this.host
    if (this.port) {
      name = `${this.host}:${this.port}`
    }

    if (this.duisTls) {
      name = `${name} (TLS)`
    }
    return name
  },
  oneditprepare() {
    $('#node-config-input-logger').typedInput({
      types: [
        {
          value: 'file',
          hasValue: true,
          label: 'Log to File',
          icon: 'fa fa-file-o',
        },
        {
          value: 'none',
          hasValue: false,
          label: 'No logging',
          icon: 'fa fa-ban',
        },
        {
          value: 'stdout',
          hasValue: false,
          label: 'Log to StdOut',
          icon: 'fa fa-check',
        },
      ],
      typeField: '#node-config-input-loggerType',
    })
    ;(
      [
        ['duis', this.duisHeaders],
        ['smki', this.smkiHeaders],
      ] as Array<[string, Headers]>
    ).forEach(([e, h]) => {
      $(`#node-input-${e}header-container`).editableList({
        addItem(row, index, data: [string, HeaderDef]) {
          const row1 = $('<div/>', {
            class: 'dccboxed-config-header-row form-row',
          }).appendTo(row)
          const row2 = $('<div/>', {
            class: 'dccboxed-config-header-row form-row',
          }).appendTo(row)

          $('<label/>')
            .attr('for', `node-input-${e}header-name-${index}`)
            .html('<i class="fa fa-tag"></i> Name')
            .appendTo(row1)
          $('<input/>', { class: 'header-single-input' })
            .attr('type', 'text')
            .attr('id', `node-input-${e}header-name-${index}`)
            .attr('placeholder', 'e.g. X-Authenticate')
            .prop('required', true)
            .val(data?.[0] ?? '')
            .appendTo(row1)

          $('<label/>')
            .attr('for', `node-input-${e}header-value-${index}`)
            .html('<i class="fa fa-tag"></i> Value')
            .appendTo(row2)
          $('<input/>', { class: 'header-single-input' })
            .attr('type', 'text')
            .attr('id', `node-input-${e}header-value-${index}`)
            .attr('placeholder', 'e.g. SuperSecretAPIKey')
            .prop('required', true)
            .val(data?.[1]?.value ?? '')
            .appendTo(row2)
          $('<input/>')
            .attr('type', 'hidden')
            .attr('id', `node-input-${e}header-value_type-${index}`)
            .val(data?.[1]?.type ?? 'str')
            .appendTo(row2)

          $(`#node-input-${e}header-value-${index}`).typedInput({
            default: 'str',
            types: ['str', 'global'],
            typeField: $(`#node-input-${e}header-value_type-${index}`),
          })
          $(`#node-input-${e}header-value-${index}`).typedInput('width', 'auto')
          $(
            `#node-input-${e}header-value-${index} ~ div input[type=text]`,
          ).attr('size', '1')
        },
        addButton: true,
        removable: true,
      })

      if (h) {
        Object.entries(h).forEach(([name, val]) => {
          $(`#node-input-${e}header-container`).editableList('addItem', [
            name,
            val,
          ])
        })
      }
    })
    $('#node-input-duisheader-container,#node-input-smkiheader-container')
      .parent()
      .attr('width', 'auto')
      .css('max-height', '15em')
  },
  oneditsave() {
    this.duisHeaders = {}
    this.smkiHeaders = {}
    ;(
      [
        ['duis', this.duisHeaders],
        ['smki', this.smkiHeaders],
      ] as Array<[string, Headers]>
    ).forEach(([e, h]) => {
      $(`#node-input-${e}header-container`)
        .editableList('items')
        .each(function () {
          const itemRoot = $(this)
          const headerName: string = itemRoot
            .find(`[id^=node-input-${e}header-name]`)
            .val() as string
          const headerDef: HeaderDef = {
            type: itemRoot
              .find(`[id^=node-input-${e}header-value_type-]`)
              .val() as 'str' | 'global',
            value: itemRoot
              .find(`[id^=node-input-${e}header-value-]`)
              .val() as string,
          }
          h[headerName] = headerDef
        })
    })
  },
  onpaletteadd() {
    RED.events.on('nodes:add', addHandler)
    RED.events.on('nodes:remove', removeHandler)
  },
  onpaletteremove() {
    RED.events.off('nodes:add', addHandler)
    RED.events.off('nodes:remove', removeHandler)
  },
})
