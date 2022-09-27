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

import { NodeAPI, NodeMessage } from 'node-red'

export function setMessageProperty(
  RED: NodeAPI,
  path: string,
  defaultPath: string
): (msg: NodeMessage, value: unknown) => void {
  path = (path ?? '').trim() || defaultPath
  return (msg, value) => {
    RED.util.setMessageProperty(msg, path, value, true)
    let ty = 'undefined'
    try {
      ty = typeof RED.util.getMessageProperty(msg, path)
    } catch {
      /* empty */
    }
    if (ty === 'undefined') {
      msg.payload = {}
      RED.util.setMessageProperty(msg, path, value, true)
    }
  }
}
