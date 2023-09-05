/*
 * Created on Fri Aug 11 2023
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

import type { NodeDef, NodeAPI } from 'node-red'

import type { Node, Properties } from './duis-tariff.properties'
import type { RequestId } from '@smartdcc/duis-parser'

import { normaliseEUI } from '@smartdcc/dccboxed-keystore'
import {
  buildUpdateImportTariff_PrimaryElement,
  isTariff,
} from '@smartdcc/duis-templates'

import { setMessageProperty } from './util'

import { examples } from './duis-tariff/duis-tariff-examples'

export = function (RED: NodeAPI) {
  function DuisTariff(this: Node, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    this.output = setMessageProperty(RED, config.output, 'payload.request')

    this.input = (msg): string | object | undefined => {
      if (config.input_type === 'msg') {
        return RED.util.getMessageProperty(
          msg,
          config.input ?? 'payload.tariff',
        )
      } else if (
        typeof config.tariffBody === 'string' &&
        config.tariffBody.trim() !== ''
      ) {
        return config.tariffBody
      } else if (typeof config.input === 'string') {
        return examples[config.input]
      }
    }

    this.originatorEUI = (msg) => {
      let eui: string
      switch (config.originatorEUI_type) {
        case 'msg': {
          const x = RED.util.getMessageProperty(
            msg,
            config.originatorEUI ?? 'payload.originatorEUI',
          )
          if (typeof x === 'string') {
            eui = x
          } else {
            throw new Error(
              `could not extract originator eui from ${config.originatorEUI}`,
            )
          }
          break
        }
        case 'eui':
          eui = config.originatorEUI as string
      }

      return normaliseEUI(eui)
        .toString()
        .replace(/([0-9a-fA-F]{2}(?!$))/g, '$1-')
    }

    this.targetEUI = (msg) => {
      let eui: string
      switch (config.targetEUI_type) {
        case 'msg': {
          const x = RED.util.getMessageProperty(
            msg,
            config.targetEUI ?? 'payload.targetEUI',
          )
          if (typeof x === 'string') {
            eui = x
          } else {
            throw new Error(
              `could not extract target eui from ${config.targetEUI}`,
            )
          }
          break
        }
        case 'eui':
          eui = config.targetEUI as string
      }

      return normaliseEUI(eui)
        .toString()
        .replace(/([0-9a-fA-F]{2}(?!$))/g, '$1-')
    }

    /* validation on node deploy of tariff body */
    if (
      config.input_type === 'example' &&
      typeof config.tariffBody === 'string' &&
      config.tariffBody.trim() !== ''
    ) {
      try {
        if (!isTariff(JSON.parse(config.tariffBody))) {
          this.error('Bad tariff entered.')
        }
      } catch (e) {
        this.error(e)
      }
    }

    this.on('input', (msg, send, done) => {
      let input = this.input(msg)

      if (input === undefined) {
        done(new Error('input tariff missing'))
        return
      }

      if (typeof input === 'string') {
        let t: unknown
        try {
          t = JSON.parse(input)
          if (typeof t === 'object' && t !== null) {
            input = t
          } else {
            done(new Error('could not parse input tariff json'))
            return
          }
        } catch (e) {
          if (e instanceof Error) {
            done(e)
          } else {
            done(new Error('unknown error while parsing json'))
          }
          return
        }
      }

      if (!isTariff(input)) {
        done(new Error('invalid tariff entered'))
        return
      }

      const originatorId = this.originatorEUI(msg)
      if (originatorId === undefined) {
        done(new Error('originatorId missing'))
        return
      }

      const targetId = this.targetEUI(msg)
      if (targetId === undefined) {
        done(new Error('targetId missing'))
        return
      }

      const requestId: RequestId<bigint> = {
        counter: BigInt(0),
        originatorId,
        targetId,
      }

      const sd = buildUpdateImportTariff_PrimaryElement(input, requestId)
      this.output(msg, sd)
      send(msg)
    })
  }
  RED.nodes.registerType('duis-tariff', DuisTariff)

  RED.httpAdmin.post(
    '/smartdcc/duis-tariff/:id',
    RED.auth.needsPermission('smartdcc.write'),
    function (req, res) {
      const node = RED.nodes.getNode(req.params.id)
      if (node !== null) {
        try {
          if (req.body && req.body.__user_inject_props__) {
            node.receive(req.body)
          } else {
            node.receive()
          }
          res.sendStatus(200)
        } catch (err) {
          res.sendStatus(500)
          node.error(`failed to inject template ${err}`)
        }
      } else {
        res.sendStatus(404)
      }
    },
  )
}
