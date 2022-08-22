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
import { minimizeMessage, parseGbcsMessage } from '@smartdcc/gbcs-parser'
import type { NodeDef, NodeAPI, NodeMessage } from 'node-red'
import { ConfigNode } from './dccboxed-config.properties'

import type { ReceiveNode, Properties } from './dccboxed-receive.properties'
import { ServerKeyStore } from './gbcs-node.common'

export = function (RED: NodeAPI) {
  function DCCBoxedReceive(this: ReceiveNode, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server) as ConfigNode

    {
      const output = (config.output ?? '').trim() || 'payload.response'
      this.output = (msg, value) => {
        RED.util.setMessageProperty(msg, output, value, true)
      }
    }

    if (config.decodeGbcs) {
      const gbcsOutput = (config.gbcsOutput ?? '').trim() || 'payload.gbcs'
      this.gbcsOutput = (msg, value) => {
        RED.util.setMessageProperty(msg, gbcsOutput, value, true)
      }
    }

    this.outputResponsesFilter = RegExp(
      config.outputResponses ? config.outputResponsesFilter ?? '.*' : '^$'
    )
    this.outputDeviceAlertsFilter = RegExp(
      config.outputDeviceAlerts ? config.outputDeviceAlertsFilter ?? '.*' : '^$'
    )
    this.outputDCCAlertsFilter = RegExp(
      config.outputDCCAlerts ? config.outputDCCAlertsFilter ?? '.*' : '^$'
    )

    {
      const { outputResponses, outputDeviceAlerts, outputDCCAlerts } = config
      this.sendOutput = function (o) {
        const msgs: (NodeMessage | null)[] = []
        if (outputResponses) {
          if (o.type === 'response') {
            msgs.push(o.payload)
          } else {
            msgs.push(null)
          }
        }
        if (outputDeviceAlerts) {
          if (o.type === 'devicealert') {
            msgs.push(o.payload)
          } else {
            msgs.push(null)
          }
        }
        if (outputDCCAlerts) {
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

    let tid: NodeJS.Timeout

    const NewDuis = (
      sd: SimplifiedDuisOutputResponse,
      msg: NodeMessage | undefined
    ) => {
      if (
        isSimplifiedDuisResponseBody_ResponseMessage(sd.body) &&
        sd.body.ResponseMessage.ServiceReferenceVariant.match(
          this.outputResponsesFilter
        ) === null
      ) {
        return this.sendOutput({ type: 'none' })
      }
      if (
        isSimplifiedDuisResponseBody_DeviceAlertMessage(sd.body) &&
        sd.body.DeviceAlertMessage.AlertCode.match(
          this.outputDeviceAlertsFilter
        ) === null
      ) {
        return this.sendOutput({ type: 'none' })
      }
      if (
        isSimplifiedDuisResponseBody_DCCAlertMessage(sd.body) &&
        sd.body.DCCAlertMessage.DCCAlertCode.match(
          this.outputDCCAlertsFilter
        ) === null
      ) {
        return this.sendOutput({ type: 'none' })
      }

      this.status({
        fill: 'green',
        shape: 'dot',
        text: `result code: ${sd.header.responseCode}`,
      })
      clearTimeout(tid)
      tid = setTimeout(() => {
        this.status({})
      }, 5000)
      msg = msg ?? { _msgid: '' }
      this.output(msg, sd)
      if (sd.header.responseCode !== 'I0') {
        this.sendOutput({ type: 'error', payload: msg })
      } else {
        if (isSimplifiedDuisResponseBody_ResponseMessage(sd.body)) {
          if (
            this.gbcsOutput &&
            isSimplifiedDuisResponseBody_ResponseMessage_X(
              'GBCSPayload',
              sd.body
            )
          ) {
            const go = this.gbcsOutput
            const _msg = msg
            parseGbcsMessage(
              sd.body.ResponseMessage.GBCSPayload,
              (eui, type, privateKey) =>
                ServerKeyStore(this.server, RED, eui, type, privateKey)
            )
              .then((gbcs) => {
                go(_msg, minimizeMessage(gbcs))
                this.sendOutput({ type: 'response', payload: _msg })
              })
              .catch((e) => this.error(e))
          } else if (
            this.gbcsOutput &&
            isSimplifiedDuisResponseBody_ResponseMessage_X(
              'FutureDatedDeviceAlertMessage',
              sd.body
            )
          ) {
            const go = this.gbcsOutput
            const _msg = msg
            parseGbcsMessage(
              sd.body.ResponseMessage.FutureDatedDeviceAlertMessage.GBCSPayload,
              (eui, type, privateKey) =>
                ServerKeyStore(this.server, RED, eui, type, privateKey)
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
          if (this.gbcsOutput) {
            const go = this.gbcsOutput
            const _msg = msg
            parseGbcsMessage(
              sd.body.DeviceAlertMessage.GBCSPayload,
              (eui, type, privateKey) =>
                ServerKeyStore(this.server, RED, eui, type, privateKey)
            )
              .then((gbcs) => {
                go(_msg, minimizeMessage(gbcs))
                this.sendOutput({ type: 'devicealert', payload: _msg })
              })
              .catch((e) => this.error(e))
            this.status({
              fill: 'green',
              shape: 'dot',
              text: `device alert code: ${sd.body.DeviceAlertMessage.AlertCode}`,
            })
          } else {
            this.sendOutput({ type: 'devicealert', payload: msg })
          }
        } else if (isSimplifiedDuisResponseBody_DCCAlertMessage(sd.body)) {
          if (this.gbcsOutput) {
            this.status({
              fill: 'green',
              shape: 'dot',
              text: `dcc alert code: ${sd.body.DCCAlertMessage.DCCAlertCode}`,
            })
          }
          this.sendOutput({ type: 'dccalert', payload: msg })
        } else {
          this.warn('unknown message received: ' + JSON.stringify(sd))
        }
      }
    }

    this.server.events.on('duis', NewDuis)
    this.on('close', () => {
      this.server.events.removeListener('duis', NewDuis)
    })
  }
  RED.nodes.registerType('dccboxed-receive', DCCBoxedReceive)
}
