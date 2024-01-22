/*
 * Created on Mon Sep 26 2022
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

import { Node, NodeAPI, NodeContext, NodeMessage } from 'node-red'
import { Context, TemplateSpans, parse, render } from 'mustache'

export function setMessageProperty(
  RED: NodeAPI,
  path: string | undefined,
  defaultPath: string,
): (msg: NodeMessage, value: unknown) => void {
  const _path = (path ?? '').trim() || defaultPath
  return (msg, value) => {
    RED.util.setMessageProperty(msg, _path, value, true)
    let ty = 'undefined'
    try {
      ty = typeof RED.util.getMessageProperty(msg, _path)
    } catch {
      /* empty */
    }
    if (ty === 'undefined') {
      msg.payload = {}
      RED.util.setMessageProperty(msg, _path, value, true)
    }
  }
}

/*
 * Below Mustache implementation was adapted from the Node-RED template node and
 * updated for TypeScript.
 *
 * For the original and licence information see:
 * https://github.com/node-red/node-red/blob/5b096bfd5ee1c9b2a5e624ee7e13aa16b145da8b/packages/node_modules/%40node-red/nodes/core/function/80-template.js
 */

function parseContext(key: string) {
  const match = /^(flow|global)(\[(\w+)\])?\.(.+)/.exec(key)
  if (match) {
    return {
      type: match[1] as 'flow' | 'global',
      store: match[3] === '' ? 'default' : match[3],
      field: match[4],
    }
  }
  return undefined
}

function parseEnv(key: string) {
  const match = /^env\.(.+)/.exec(key)
  if (match) {
    return match[1]
  }
  return undefined
}

function extractTokens(tokens: TemplateSpans, set?: Set<string>): Set<string> {
  const _set = set ?? new Set()
  tokens.forEach((token) => {
    if (token[0] !== 'text') {
      _set.add(token[1])
      if (token.length > 4) {
        if (Array.isArray(token[4])) {
          extractTokens(token[4], _set)
        } else {
          throw new Error(`unknown token ${token}`)
        }
      }
    }
  })
  return _set
}

export class MustacheNodeContext extends Context {
  constructor(
    private msg: NodeMessage,
    private nodeContext: NodeContext,
    parent: Context | undefined,
    private escapeStrings: boolean,
    private cachedContextTokens: Record<string, string>,
  ) {
    super(msg, parent)
  }

  public lookup(name: string) {
    // try message first:
    let value = super.lookup(name)
    if (value !== undefined) {
      if (this.escapeStrings && typeof value === 'string') {
        value = value.replace(/\\/g, '\\\\')
        value = value.replace(/\n/g, '\\n')
        value = value.replace(/\t/g, '\\t')
        value = value.replace(/\r/g, '\\r')
        value = value.replace(/\f/g, '\\f')
        value = value.replace(/[\b]/g, '\\b')
      }
      return value
    }

    // try env
    if (parseEnv(name)) {
      return this.cachedContextTokens[name]
    }

    // try flow/global context:
    const context = parseContext(name)
    if (context) {
      const type = context.type
      //const store = context.store
      //const field = context.field
      const target = this.nodeContext[type]
      if (target) {
        return this.cachedContextTokens[name]
      }
    }
    return ''
  }

  public push(view: NodeMessage): Context {
    return new MustacheNodeContext(
      view,
      this.nodeContext,
      this,
      false,
      this.cachedContextTokens,
    )
  }
}

function isPair(o: unknown): o is [string, string] {
  return (
    Array.isArray(o) &&
    o.length === 2 &&
    typeof o[0] === 'string' &&
    typeof o[1] === 'string'
  )
}

export function runMustache(
  RED: NodeAPI,
  template: string,
  node: Node,
  msg: NodeMessage,
): Promise<string>
export function runMustache(
  RED: NodeAPI,
  template: object,
  node: Node,
  msg: NodeMessage,
): Promise<object>
export async function runMustache(
  RED: NodeAPI,
  template: string | object,
  node: Node,
  msg: NodeMessage,
): Promise<string | object> {
  const templateNormalised =
    typeof template === 'string' ? template : JSON.stringify(template)

  const resolvedTokens = Object.fromEntries(
    (
      await Promise.all(
        Array.from(extractTokens(parse(templateNormalised))).map((token) => {
          const env_name = parseEnv(token)
          if (env_name) {
            return Promise.resolve<[string, string]>([
              token,
              RED.util.evaluateNodeProperty(env_name, 'env', node, msg),
            ])
          }

          const context = parseContext(token)
          if (context) {
            const type = context.type
            const store = context.store
            const field = context.field
            const target = node.context()[type]
            return new Promise<[string, string]>((resolve, reject) => {
              target.get(field, store, (err, val) => {
                if (err) {
                  reject(err)
                } else {
                  resolve([token, val as string])
                }
              })
            })
          }
          return Promise.resolve()
        }),
      )
    ).filter(isPair),
  )

  const result = render(
    templateNormalised,
    new MustacheNodeContext(
      msg,
      node.context(),
      undefined,
      typeof template !== 'string',
      resolvedTokens,
    ),
  )
  if (typeof template === 'string') {
    return result
  } else {
    return JSON.parse(result)
  }
}
