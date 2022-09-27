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

import { EUI, normaliseEUI } from '@smartdcc/dccboxed-keystore'
import { utrn } from '@smartdcc/gbcs-parser'
import { NodeAPI, NodeDef } from 'node-red'
import { bootstrap } from './gbcs-node.common'
import { Node, Properties } from './gbcs-utrn.properties'
import { setMessageProperty } from './util'

export = function (RED: NodeAPI) {
  function GbcsUtrn(this: Node, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    bootstrap.bind(this)(config, RED)
    this.outputUtrn = setMessageProperty(
      RED,
      config.outputUtrn,
      'payload.utrn.token'
    )
    this.outputCounter = setMessageProperty(
      RED,
      config.outputCounter,
      'payload.utrn.counter'
    )

    {
      if (config.signerEUI_type === 'msg') {
        const signerEUI =
          (config.signerEUI ?? '').trim() || 'payload.originator'
        this.signerEUI = (msg) => {
          RED.util.getMessageProperty(msg, signerEUI)
        }
      } else {
        const eui = new EUI(config.signerEUI)
        this.signerEUI = () => eui.toString()
      }
    }

    {
      if (config.deviceEUI_type === 'msg') {
        const deviceEUI = (config.deviceEUI ?? '').trim() || 'payload.target'
        this.deviceEUI = (msg) => {
          RED.util.getMessageProperty(msg, deviceEUI)
        }
      } else {
        const eui = new EUI(config.deviceEUI)
        this.deviceEUI = () => eui.toString()
      }
    }

    {
      switch (config.counter_type) {
        case 'msg': {
          const counter = (config.counter ?? '').trim() || 'payload.counter'
          this.counter = (msg) => RED.util.getMessageProperty(msg, counter)
          break
        }
        case 'epoch':
          this.counter = () =>
            BigInt(Math.floor(Date.now() / 1000)) << BigInt(32)
          break
        default: {
          let counter: bigint
          try {
            counter = BigInt(config.counter)
          } catch {
            throw new Error('utrn counter should be an integer')
          }
          if (counter < BigInt(0)) {
            throw new Error('utrn counter should positive')
          }
          if ((counter & BigInt('0xffffffff')) > BigInt(0)) {
            throw new Error('low 32 bit of utrn counter should be 0')
          }
          this.counter = () => counter
        }
      }
    }

    {
      if (config.value_type === 'msg') {
        this.value = (msg) => {
          const value = (config.value ?? '').trim() || 'payload.value'
          RED.util.getMessageProperty(msg, value)
        }
      } else {
        const value = Number(config.value)
        if (
          Number.isNaN(value) ||
          value < 0 ||
          value > 8191 ||
          !Number.isInteger(value)
        ) {
          throw new Error(
            'utrn value should be integer between 0 and 8191 (inclusive)'
          )
        }
        this.value = () => value
      }
    }

    {
      if (config.class_type === 'msg') {
        this.class = (msg) => {
          const _class = (config.class ?? '').trim() || 'payload.class'
          RED.util.getMessageProperty(msg, _class)
        }
      } else {
        const _class = config.class
        if (_class !== 'pounds' && _class !== 'pennies') {
          throw new Error('utrn class should be "pounds" or "pennies"')
        }
        this.class = () => _class
      }
    }

    this.on('input', (msg, send, done) => {
      const maybeCounter = this.counter(msg)
      if (
        typeof maybeCounter !== 'string' &&
        typeof maybeCounter !== 'bigint' &&
        typeof maybeCounter !== 'number'
      ) {
        done(new Error('utrn counter should be an integer'))
        return
      }
      let counter: bigint
      try {
        counter = BigInt(maybeCounter)
      } catch {
        done(new Error('utrn counter should be an integer'))
        return
      }
      if (counter < BigInt(0)) {
        done(new Error('utrn counter should positive'))
        return
      }
      if ((counter & BigInt('0xffffffff')) > BigInt(0)) {
        console.log(counter)
        done(new Error('low 32 bit of utrn counter should be 0'))
        return
      }

      const ptutValue = Number(this.value(msg))
      if (
        Number.isNaN(ptutValue) ||
        ptutValue < 0 ||
        ptutValue > 8191 ||
        !Number.isInteger(ptutValue)
      ) {
        done(
          new Error(
            'utrn value should be integer between 0 and 8191 (inclusive)'
          )
        )
        return
      }

      const ptutClass = this.class(msg)
      if (ptutClass !== 'pounds' && ptutClass !== 'pennies') {
        done(new Error('utrn class should be either "pounds" or "pennies"'))
        return
      }

      let originator: string
      const maybeOriginator = this.signerEUI(msg)
      try {
        if (typeof maybeOriginator === 'string') {
          originator = normaliseEUI(maybeOriginator)
        } else if (ArrayBuffer.isView(maybeOriginator)) {
          originator = normaliseEUI(new Uint8Array(maybeOriginator.buffer))
        } else {
          done(new Error('signer eui should be a string'))
          return
        }
      } catch {
        done(new Error('signer eui should be string of 16 hex chars'))
        return
      }

      let target: string
      const maybeTarget = this.deviceEUI(msg)
      try {
        if (typeof maybeTarget === 'string') {
          target = normaliseEUI(maybeTarget)
        } else if (ArrayBuffer.isView(maybeTarget)) {
          target = normaliseEUI(new Uint8Array(maybeTarget.buffer))
        } else {
          done(new Error('target eui should be a string'))
          return
        }
      } catch {
        done(new Error('target eui should be string of 16 hex chars'))
        return
      }

      utrn({
        counter,
        value: ptutValue,
        valueClass: ptutClass,
        originator,
        target,
        lookupKey: this.keyStore,
      })
        .then((utrn) => {
          this.outputUtrn(msg, utrn)
          this.outputCounter(msg, counter)
          send(msg)
        })
        .catch(done)
    })
  }
  RED.nodes.registerType('gbcs-utrn', GbcsUtrn)

  RED.httpAdmin.post(
    '/smartdcc/gbcs-utrn/:id',
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
    }
  )
}
