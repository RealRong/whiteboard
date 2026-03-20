import type { BoardConfig } from '@whiteboard/core/config'
import { reduceOperations } from '@whiteboard/core/kernel'
import { normalizeGroupBounds } from '@whiteboard/core/node'
import {
  assertDocument,
  type Document
} from '@whiteboard/core/types'
import {
  DEFAULT_TUNING,
  resolveBoardConfig
} from '../config'

export const normalizeDocument = (
  document: Document,
  configOverrides?: Partial<BoardConfig> | BoardConfig
): Document => {
  const committedDocument = assertDocument(document)
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
