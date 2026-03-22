import type { BoardConfig } from '@whiteboard/core/config'
import { reduceOperations } from '@whiteboard/core/kernel'
import { normalizeGroupBounds } from '@whiteboard/core/node'
import {
  assertDocument,
  type Node,
  type Document
} from '@whiteboard/core/types'
import {
  DEFAULT_TUNING,
  resolveBoardConfig
} from '../config'

const stripGroupRotationFromDocument = (
  document: Document
): Document => {
  let changed = false
  const entities: Record<string, Node> = {}

  Object.entries(document.nodes.entities).forEach(([id, node]) => {
    if (node.type === 'group' && node.rotation !== undefined) {
      const { rotation: _rotation, ...nextNode } = node
      entities[id] = nextNode
      changed = true
      return
    }

    entities[id] = node
  })

  return changed
    ? {
        ...document,
        nodes: {
          ...document.nodes,
          entities
        }
      }
    : document
}

export const normalizeDocument = (
  document: Document,
  configOverrides?: Partial<BoardConfig> | BoardConfig
): Document => {
  const committedDocument = stripGroupRotationFromDocument(
    assertDocument(document)
  )
  const config = resolveBoardConfig(configOverrides)
  const operations = normalizeGroupBounds({
    document: committedDocument,
    nodeSize: config.nodeSize,
    groupPadding: config.node.groupPadding,
    rectEpsilon: DEFAULT_TUNING.group.rectEpsilon
  })
  if (!operations.length) {
    return committedDocument
  }

  const reduced = reduceOperations(committedDocument, operations, {
    origin: 'system',
    now: () => 0
  })
  return reduced.ok
    ? reduced.doc
    : committedDocument
}
