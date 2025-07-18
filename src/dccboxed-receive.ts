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

import {
  isSimplifiedDuisResponseBody_DCCAlertMessage,
  isSimplifiedDuisResponseBody_DeviceAlertMessage,
  isSimplifiedDuisResponseBody_ResponseMessage,
  isSimplifiedDuisResponseBody_ResponseMessage_X,
  SimplifiedDuisOutputResponse,
} from '@smartdcc/duis-parser'
import {
  decodeECS24,
  minimizeMessage,
  parseGbcsMessage,
} from '@smartdcc/gbcs-parser'
import type { NodeDef, NodeAPI, NodeMessage, NodeStatus } from 'node-red'
import { ConfigNode } from './dccboxed-config.properties'

import type { ReceiveNode, Properties } from './dccboxed-receive.properties'
import { ServerKeyStore } from './gbcs-node.common'
import { setMessageProperty } from './util'
import { getAlertCodeName } from '@smartdcc/gbcs-parser/dist/util'

function buildRegExp(ty: string, value?: string): RegExp {
  switch (ty) {
    case 'none':
      return RegExp(/(?!x)x/) // contradiction regex
    case 're':
      return RegExp(value ?? '.*')
    case 'list':
      if (value !== undefined) {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
        const values = value
          .split(',')
          .map((s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        return RegExp(`^(${values.reduce((a, x) => `${a}|${x}`)})$`)
      }
  }
  return RegExp('.*')
}

export = function (RED: NodeAPI) {
  function DCCBoxedReceive(this: ReceiveNode, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server) as ConfigNode
    this.notifyDeviceAlerts = Boolean(config.notifyDeviceAlerts)
    this.decodeGbcs = Boolean(config.decodeGbcs)

    this.output = setMessageProperty(RED, config.output, 'payload.response')
    this.gbcsOutput = setMessageProperty(RED, config.gbcsOutput, 'payload.gbcs')

    this.outputResponsesFilter = buildRegExp(
      config.outputResponsesFilterType,
      config.outputResponsesFilter,
    )
    this.outputDeviceAlertsFilter = buildRegExp(
      config.outputDeviceAlertsFilterType,
      config.outputDeviceAlertsFilter,
    )
    this.outputDCCAlertsFilter = buildRegExp(
      config.outputDCCAlertsFilterType,
      config.outputDCCAlertsFilter,
    )

    {
      const {
        outputResponsesFilterType,
        outputDeviceAlertsFilterType,
        outputDCCAlertsFilterType,
      } = config
      this.sendOutput = function (o) {
        const msgs: (NodeMessage | null)[] = []
        if (outputResponsesFilterType !== 'none') {
          if (o.type === 'response') {
            msgs.push(o.payload)
          } else {
            msgs.push(null)
          }
        }
        if (outputDeviceAlertsFilterType !== 'none') {
          if (o.type === 'devicealert') {
            msgs.push(o.payload)
          } else {
            msgs.push(null)
          }
        }
        if (outputDCCAlertsFilterType !== 'none') {
          if (o.type === 'dccalert') {
            msgs.push(o.payload)
          } else {
            msgs.push(null)
          }
        }
        if (o.type === 'error') {
          msgs.push(o.payload)
        } else {
          msgs.push(null)
        }
        this.send(msgs)
      }
    }

    let timerId: NodeJS.Timeout | undefined = undefined
    const setStatus: (status: NodeStatus) => void = (status) => {
      if (timerId !== undefined) {
        clearTimeout(timerId)
      }
      this.status(status)
      timerId = setTimeout(() => {
        this.status({})
        timerId = undefined
      }, 5000)
    }

    const NewDuis = (
      sd: SimplifiedDuisOutputResponse,
      msg: NodeMessage | undefined,
    ) => {
      if (
        isSimplifiedDuisResponseBody_ResponseMessage(sd.body) &&
        sd.body.ResponseMessage.ServiceReferenceVariant.match(
          this.outputResponsesFilter,
        ) === null
      ) {
        return this.sendOutput({ type: 'none' })
      }
      if (
        isSimplifiedDuisResponseBody_DeviceAlertMessage(sd.body) &&
        sd.body.DeviceAlertMessage.AlertCode.match(
          this.outputDeviceAlertsFilter,
        ) === null
      ) {
        return this.sendOutput({ type: 'none' })
      }
      if (
        isSimplifiedDuisResponseBody_DCCAlertMessage(sd.body) &&
        sd.body.DCCAlertMessage.DCCAlertCode.match(
          this.outputDCCAlertsFilter,
        ) === null
      ) {
        return this.sendOutput({ type: 'none' })
      }

      setStatus({
        fill: 'green',
        shape: 'dot',
        text: `result code: ${sd.header.responseCode}`,
      })
      if (msg) {
        // shallow clone msg object
        msg = { ...msg }
        // shallow clone payload object
        if ('payload' in msg && typeof msg.payload === 'object') {
          msg.payload = { ...msg.payload }
        }
      } else {
        msg = { _msgid: '' }
      }
      this.output(msg, sd)
      if (sd.header.responseCode !== 'I0') {
        this.sendOutput({ type: 'error', payload: msg })
      } else {
        if (isSimplifiedDuisResponseBody_ResponseMessage(sd.body)) {
          setStatus({
            fill: 'green',
            shape: 'dot',
            text: `device response: ${sd.body.ResponseMessage.ServiceReferenceVariant}`,
          })
          if (
            this.gbcsOutput &&
            isSimplifiedDuisResponseBody_ResponseMessage_X(
              'GBCSPayload',
              sd.body,
            ) &&
            this.decodeGbcs
          ) {
            const go = this.gbcsOutput
            const _msg = msg
            parseGbcsMessage(
              sd.body.ResponseMessage.GBCSPayload,
              (eui, type, options) =>
                ServerKeyStore(this.server, RED, eui, type, options),
              '90 B3 D5 1F 30 00 00 02',
            )
              .then((gbcs) => {
                const mgbcs = minimizeMessage(gbcs)
                const ecs24 = decodeECS24(mgbcs)

                if (ecs24) {
                  go(_msg, { ...mgbcs, ecs24 })
                } else {
                  go(_msg, mgbcs)
                }

                this.sendOutput({ type: 'response', payload: _msg })
              })
              .catch((e) => this.error(e))
          } else if (
            this.gbcsOutput &&
            isSimplifiedDuisResponseBody_ResponseMessage_X(
              'FutureDatedDeviceAlertMessage',
              sd.body,
            ) &&
            this.decodeGbcs
          ) {
            const go = this.gbcsOutput
            const _msg = msg
            parseGbcsMessage(
              sd.body.ResponseMessage.FutureDatedDeviceAlertMessage.GBCSPayload,
              (eui, type, options) =>
                ServerKeyStore(this.server, RED, eui, type, options),
              '90 B3 D5 1F 30 00 00 02',
            )
              .then((gbcs) => {
                go(_msg, minimizeMessage(gbcs))
                this.sendOutput({ type: 'response', payload: _msg })
              })
              .catch((e) => this.error(e))
          } else {
            this.sendOutput({ type: 'response', payload: msg })
          }
        } else if (isSimplifiedDuisResponseBody_DeviceAlertMessage(sd.body)) {
          if (this.gbcsOutput && this.decodeGbcs) {
            const go = this.gbcsOutput
            const _msg = msg
            const _body = sd.body
            parseGbcsMessage(
              sd.body.DeviceAlertMessage.GBCSPayload,
              (eui, type, options) =>
                ServerKeyStore(this.server, RED, eui, type, options),
              '90 B3 D5 1F 30 00 00 02',
            )
              .then((gbcs) => {
                go(_msg, minimizeMessage(gbcs))
                this.sendOutput({ type: 'devicealert', payload: _msg })
              })
              .catch((e) => this.error(e))
            setStatus({
              fill: 'green',
              shape: 'dot',
              text: `device alert code: ${sd.body.DeviceAlertMessage.AlertCode}`,
            })
            const alertDescription = getAlertCodeName(
              Number(`0x${_body.DeviceAlertMessage.AlertCode}`),
            )
            if (
              typeof alertDescription === 'string' &&
              this.notifyDeviceAlerts
            ) {
              this.server.publish(this.id, {
                kind: 'notification',
                message: `Device Alert: ${alertDescription}`,
              })
            }
          } else {
            this.sendOutput({ type: 'devicealert', payload: msg })
          }
        } else if (isSimplifiedDuisResponseBody_DCCAlertMessage(sd.body)) {
          setStatus({
            fill: 'green',
            shape: 'dot',
            text: `dcc alert code: ${sd.body.DCCAlertMessage.DCCAlertCode}`,
          })
          this.sendOutput({ type: 'dccalert', payload: msg })
        } else {
          this.warn('unknown message received: ' + JSON.stringify(sd))
        }
      }
    }

    this.server.events.on('duis', NewDuis)
    this.server.events.on('error', (e) => this.warn(e))

    this.on('close', () => {
      this.server.events.removeListener('duis', NewDuis)
    })
  }
  RED.nodes.registerType('dccboxed-receive', DCCBoxedReceive)
}
