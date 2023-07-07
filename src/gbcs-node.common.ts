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

import type { NodeDef, NodeAPI } from 'node-red'
import { ConfigNode } from './dccboxed-config.properties'
import { KeyObject, createPublicKey, createPrivateKey } from 'node:crypto'

import type { GbcsNode, Properties } from './gbcs-node.properties'
import { normaliseEUI, KeyUsage } from '@smartdcc/dccboxed-keystore'

function removeNotBoxedEntries<T extends { role?: number; name?: string }>(
  prepayment: boolean,
): ({ role, name }: T) => boolean {
  return ({ role, name }: T) =>
    role !== 135 &&
    (name === undefined ||
      (prepayment && name.match(/^Z1-[a-zA-Z0-9]+PP-/) !== null) ||
      (!prepayment &&
        (name.match(/^Z1-[a-zA-Z0-9]+(?!PP)[a-zA-Z0-9]{2}-/) !== null ||
          name.startsWith('otherUser-'))))
}

export async function ServerKeyStore(
  server: ConfigNode,
  RED: NodeAPI,
  eui: string | Uint8Array,
  type: 'KA' | 'DS',
  options: {
    privateKey?: boolean
    prePayment?: boolean
  },
): Promise<KeyObject> {
  if (options.privateKey) {
    let results = await server.keyStore?.query({
      eui,
      keyUsage:
        type === 'DS' ? KeyUsage.digitalSignature : KeyUsage.keyAgreement,
      lookup: 'privateKey',
    })
    results = (results ?? []).filter(
      removeNotBoxedEntries(options.prePayment ?? false),
    )
    if (results.length === 1) {
      return results[0].privateKey
    } else {
      RED.log.warn(
        `searching for ${normaliseEUI(eui)} privateKey ${
          options.prePayment ? '(prepayment)' : ''
        } found ${results.length} candidates`,
      )
    }
  } else {
    let results = await server.keyStore?.query({
      eui,
      keyUsage:
        type === 'DS' ? KeyUsage.digitalSignature : KeyUsage.keyAgreement,
      lookup: 'certificate',
    })
    results = (results ?? []).filter(
      removeNotBoxedEntries(options.prePayment ?? false),
    )
    if (results.length === 1) {
      return results[0].certificate.publicKey
    } else {
      RED.log.warn(
        `searching for ${normaliseEUI(eui)} certificate ${
          options.prePayment ? '(prepayment)' : ''
        } found ${results.length} candidates`,
      )
    }
  }
  throw new Error(
    `${options.privateKey ? 'private' : 'public'} key ${
      options.prePayment ? '(prepayment)' : ''
    } not found for ${normaliseEUI(eui)} for ${type}`,
  )
}

export function bootstrap(
  this: GbcsNode,
  config: Properties & NodeDef,
  RED: NodeAPI,
) {
  if (config.server) {
    this.server = RED.nodes.getNode(config.server) as ConfigNode
  }

  this.localKeys = []
  if ((config.keys?.length ?? 0) > 0) {
    for (const keyDef of config.keys) {
      let key: KeyObject
      try {
        if (keyDef.type === 'privateKey') {
          key = createPrivateKey(keyDef.content)
        } else {
          key = createPublicKey(keyDef.content)
        }
      } catch {
        throw new Error(
          `unable to load ${keyDef.type} for ${keyDef.name} (${keyDef.eui})`,
        )
      }
      this.localKeys.push({
        eui: keyDef.eui,
        privateKey: keyDef.type === 'privateKey',
        type: keyDef.usage,
        key,
        prePayment: keyDef.prePayment,
      })
    }
  }

  this.keyStore = async (eui, type, options) => {
    const local = this.localKeys.find((ke) => {
      return (
        normaliseEUI(ke.eui) === normaliseEUI(eui) &&
        ke.type === type &&
        !!options.privateKey === ke.privateKey &&
        !!options.prePayment === ke.prePayment
      )
    })
    if (local !== undefined) {
      return local?.key
    }
    if (this.server !== undefined) {
      return ServerKeyStore(this.server, RED, eui, type, options)
    }
    throw new Error(
      `${
        options.privateKey ? 'private' : 'public'
      } key not found for ${normaliseEUI(eui)} for ${type}`,
    )
  }
}
