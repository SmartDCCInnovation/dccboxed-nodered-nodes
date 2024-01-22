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

import type {
  Node,
  Properties,
  TemplateDTO,
  TemplateLookupDTO,
} from './duis-template.properties'
import { loadTemplates, search } from '@smartdcc/duis-templates'

import structuredClone from '@ungap/structured-clone'
import { extractEUI, runMustache, setMessageProperty } from './util'
import { isXMLData } from '@smartdcc/duis-parser'

export = function (RED: NodeAPI) {
  /* asynchronously load the templates on startup */
  let logCounter = 0
  const templates = loadTemplates({
    logger(msg) {
      logCounter += 1
      if (logCounter < 3) {
        RED.log.warn(msg)
      } else if (logCounter === 3) {
        RED.log.info('skipping further template loading issues')
      }
    },
  })

  templates
    .then(() => RED.log.info('duis-templates loaded successfully'))
    .catch((e) => RED.log.error(e))

  const fuse = templates.then((templates) => search(templates))

  function DuisTemplate(this: Node, config: Properties & NodeDef) {
    RED.nodes.createNode(this, config)
    this.minimal = config.minimal
    this.output = setMessageProperty(RED, config.output, 'payload.request')
    this.template = config.template
    if (
      typeof config.templateBody === 'string' &&
      config.templateBody.trim() !== ''
    ) {
      try {
        this.templateBody = JSON.parse(config.templateBody ?? '')
      } catch (e) {
        this.error(e)
      }
    }

    let _showWarning = true
    const showWarning = () => {
      if (_showWarning) {
        _showWarning = false
        return true
      }
      return false
    }

    this.originatorEUI = extractEUI(
      RED,
      config.originatorEUI,
      config.originatorEUI_type,
      'payload.originatorEUI',
      this,
      showWarning,
    )

    this.targetEUI = extractEUI(
      RED,
      config.targetEUI,
      config.targetEUI_type,
      'payload.targetEUI',
      this,
      showWarning,
    )

    this.on('input', (msg, send, done) => {
      templates
        .then((templates) =>
          templates[this.template]
            ? templates[this.template]
            : Promise.reject(`template ${this.template} not found`),
        )
        .then(async (template) => {
          if (this.minimal) {
            const sd = structuredClone(template.simplified)
            if (this.templateBody) {
              sd.body = structuredClone(this.templateBody)
            }
            const processedTemplate = await runMustache(RED, sd.body, this, msg)
            if (isXMLData(processedTemplate)) {
              sd.body = processedTemplate
            } else {
              this.warn(`failed to run mustache`)
            }
            const originatorEUI = await this.originatorEUI(msg)
            if (originatorEUI && sd.header.type === 'request') {
              sd.header.requestId.originatorId = originatorEUI
            }
            const targetEUI = await this.targetEUI(msg)
            if (targetEUI && sd.header.type === 'request') {
              sd.header.requestId.targetId = targetEUI
            }
            sd.header.requestId.counter = BigInt(0)
            this.output(msg, sd)
          } else {
            this.output(msg, structuredClone(template.normal))
          }
          send(msg)
        })
        .catch(done)
    })
  }
  RED.nodes.registerType('duis-template', DuisTemplate)

  RED.httpAdmin.post(
    '/smartdcc/duis-template/:id',
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

  RED.httpAdmin.get(
    '/smartdcc/duis-template/search',
    RED.auth.needsPermission('smartdcc.read'),
    function (req, res) {
      if (!('q' in req.query) || typeof req.query.q !== 'string') {
        res.json([])
        return
      }
      fuse
        .then((fuse) => {
          const results = fuse.search(req.query.q as string)
          res.json(
            results.map((r): TemplateDTO => {
              const optionals: Omit<
                TemplateDTO,
                'tag' | 'serviceReferenceVariant' | 'matches' | 'commandVariant'
              > = {}
              if (r.item[1].gbcs) {
                optionals.gbcs = r.item[1].gbcs
              }
              if (r.item[1].gbcsTitle) {
                optionals.gbcsTitle = r.item[1].gbcsTitle
              }
              if (r.item[1].gbcsVariant) {
                optionals.gbcsVariant = r.item[1].gbcsVariant
              }
              if (r.item[1].info) {
                optionals.info = r.item[1].info
              }
              return {
                tag: r.item[0],
                serviceReferenceVariant: r.item[1].serviceReferenceVariant,
                commandVariant: r.item[1].simplified.header.commandVariant,
                ...optionals,
                matches: (r.matches ?? []).map((match) =>
                  Object.assign({}, match, {
                    key: match.key?.replace(/^0\./, 'tag.').replace(/^1\./, ''),
                  }),
                ),
              }
            }),
          )
        })
        .catch((e) => {
          RED.log.error(e)
          res.sendStatus(500)
        })
    },
  )

  RED.httpAdmin.get(
    '/smartdcc/duis-template/lookup/:id',
    RED.auth.needsPermission('smartdcc.read'),
    function (req, res) {
      templates
        .then((templates) => {
          const template = templates[req.params.id]
          if (!template) {
            res.sendStatus(404)
          } else {
            const item: TemplateLookupDTO = {
              tag: req.params.id,
              serviceReferenceVariant: template.serviceReferenceVariant,
              commandVariant: template.simplified.header.commandVariant,
              gbcs: template.gbcs,
              gbcsTitle: template.gbcsTitle,
              gbcsVariant: template.gbcsVariant,
              info: template.info,
              body: template.simplified.body,
            }
            res.json(item)
          }
        })
        .catch((e) => {
          RED.log.error(e)
          res.sendStatus(500)
        })
    },
  )
}
