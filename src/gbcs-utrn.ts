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

import { utrn } from '@smartdcc/gbcs-parser'
import { NodeAPI, NodeDef } from 'node-red'
import { bootstrap } from './gbcs-node.common'
import { Node, Properties } from './gbcs-utrn.properties'
import { extractEUI, setMessageProperty } from './util'

export = function (RED: NodeAPI) {
  function GbcsUtrn(this: Node, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    bootstrap.bind(this)(config, RED)
    this.outputUtrn = setMessageProperty(
      RED,
      config.outputUtrn,
      'payload.utrn.token',
    )
    this.outputCounter = setMessageProperty(
      RED,
      config.outputCounter,
      'payload.utrn.counter',
    )

    this.signerEUI = extractEUI(
      RED,
      config.signerEUI,
      config.signerEUI_type,
      'payload.originator',
      this,
      () => true,
    )

    this.deviceEUI = extractEUI(
      RED,
      config.deviceEUI,
      config.deviceEUI_type,
      'payload.target',
      this,
      () => true,
    )

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
        const value = (config.value ?? '').trim() || 'payload.value'
        this.value = (msg) => RED.util.getMessageProperty(msg, value)
      } else {
        const value = Number(config.value)
        if (
          Number.isNaN(value) ||
          value < 0 ||
          value > 8191 ||
          !Number.isInteger(value)
        ) {
          throw new Error(
            'utrn value should be integer between 0 and 8191 (inclusive)',
          )
        }
        this.value = () => value
      }
    }

    {
      if (config.class_type === 'msg') {
        const _class = (config.class ?? '').trim() || 'payload.class'
        this.class = (msg) => RED.util.getMessageProperty(msg, _class)
      } else {
        const _class = config.class
        if (_class !== 'pounds' && _class !== 'pennies') {
          throw new Error('utrn class should be "pounds" or "pennies"')
        }
        this.class = () => _class
      }
    }

    this.on('input', async (msg, send, done) => {
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
            'utrn value should be integer between 0 and 8191 (inclusive)',
          ),
        )
        return
      }

      const ptutClass = this.class(msg)
      if (ptutClass !== 'pounds' && ptutClass !== 'pennies') {
        done(new Error('utrn class should be either "pounds" or "pennies"'))
        return
      }

      let originator: string
      try {
        const maybeOriginator = await this.signerEUI(msg)
        if (typeof maybeOriginator === 'string') {
          originator = maybeOriginator
        } else {
          done(new Error('signer eui should be a string'))
          return
        }
      } catch (err) {
        done(err as Error)
        return
      }

      let target: string
      try {
        const maybeTarget = await this.deviceEUI(msg)
        if (typeof maybeTarget === 'string') {
          target = maybeTarget
        } else {
          done(new Error('target eui should be a string'))
          return
        }
      } catch (err) {
        done(err as Error)
        return
      }

      try {
        const _utrn = await utrn({
          counter,
          value: ptutValue,
          valueClass: ptutClass,
          originator,
          target,
          lookupKey: this.keyStore,
        })

        this.outputUtrn(msg, _utrn)
        this.outputCounter(msg, counter)
        send(msg)
      } catch (e) {
        done(e as Error)
      }
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
    },
  )
}
