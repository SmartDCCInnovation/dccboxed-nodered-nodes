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

import { signGroupingHeader } from '@smartdcc/gbcs-parser'
import type { NodeDef, NodeAPI } from 'node-red'

import type { GbcsSignerNode, Properties } from './gbcs-signer.properties'
import { bootstrap } from './gbcs-node.common'
import { EUI } from '@smartdcc/dccboxed-keystore'

export = function (RED: NodeAPI) {
  function GbcsSigner(this: GbcsSignerNode, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    bootstrap.bind(this)(config, RED)
    {
      const precommand =
        (config.precommand ?? '').trim() || 'payload.precommand'
      this.precommand = (msg) => RED.util.getMessageProperty(msg, precommand)
    }
    {
      const signedprecommand =
        (config.signedprecommand ?? '').trim() || 'payload.signedprecommand'
      this.signedprecommand = (msg, value) => {
        RED.util.setMessageProperty(msg, signedprecommand, value, true)
      }
    }
    this.signerEUI =
      config.signerEUI_type === 'msg'
        ? config.signerEUI
        : new EUI(config.signerEUI)
    this.on('input', (msg, send, done) => {
      const maybePrecommand = this.precommand(msg)
      let precommand: string
      if (Buffer.isBuffer(maybePrecommand)) {
        precommand = maybePrecommand.toString('utf-8')
      } else if (typeof maybePrecommand === 'string') {
        precommand = maybePrecommand
      } else {
        done(
          new Error(
            `pre-command ${this.precommand} must be base64 encoded string or buffer`
          )
        )
        return
      }
      let originatorId: string
      if (typeof this.signerEUI === 'string') {
        const maybeOriginatorId = RED.util.getMessageProperty(
          msg,
          this.signerEUI
        )
        if (typeof maybeOriginatorId === 'string') {
          originatorId = maybeOriginatorId
        } else {
          done(new Error(`signer id ${this.signerEUI} must be a eui string`))
          return
        }
      } else {
        originatorId = this.signerEUI.toString()
      }
      signGroupingHeader(originatorId, precommand, this.keyStore)
        .then((b) => {
          this.signedprecommand(msg, b)
          send(msg)
        })
        .catch(done)
    })
  }
  RED.nodes.registerType('gbcs-signer', GbcsSigner)
}
