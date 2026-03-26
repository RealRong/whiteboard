import {
  normalizeGroupBounds
} from '@whiteboard/core/node'
import { reduceOperations } from '@whiteboard/core/kernel'
import type {
  Document,
  NodeId,
  Operation,
  Size
} from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../../config'

export const collectGroupOps = ({
  document,
  nodeIds: _nodeIds,
  nodeSize,
  groupPadding
}: {
  document: Document
  nodeIds: Iterable<NodeId>
  nodeSize: Size
  groupPadding: number
}) => normalizeGroupBounds({
    document,
    nodeSize,
    groupPadding,
    rectEpsilon: DEFAULT_TUNING.group.rectEpsilon
  })

export const normalizeGroups = ({
  document,
  nodeSize,
  groupPadding
}: {
  document: Document
  nodeSize: Size
  groupPadding: number
}): Document => {
  const nodeIds = Object.keys(document.nodes.entities)
  if (!nodeIds.length) {
    return document
  }

  const operations = collectGroupOps({
    document,
    nodeIds,
    nodeSize,
    groupPadding
  })
  if (!operations.length) {
    return document
  }

  const reduced = reduceOperations(document, operations, {
    origin: 'system',
    now: () => 0
  })
  return reduced.ok
    ? reduced.doc
    : document
}
