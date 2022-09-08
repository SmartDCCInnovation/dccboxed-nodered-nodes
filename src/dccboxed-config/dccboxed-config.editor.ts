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
import type { Properties } from '../dccboxed-config.properties'

declare const RED: EditorRED

RED.nodes.registerType<Properties & EditorNodeProperties>('dccboxed-config', {
  category: 'config',
  defaults: {
    host: {
      value: '1.2.3.4',
      required: true,
      validate: RED.validators.regex(
        /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}$/
      ),
    },
    port: { value: 8079, required: true, validate: RED.validators.number() },
    responseEndpoint: {
      value: '/smartdcc/duis',
      required: true,
      validate: RED.validators.regex(/^\/smartdcc\/[a-zA-Z0-9]+/),
    },
    localKeyStore: {
      value: undefined,
      required: false,
    },
    logger: { value: undefined },
    loggerType: { value: 'stdout', required: true },
  },
  label: function () {
    return this.name ?? `${this.host}:${this.port}`
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
  },
})
