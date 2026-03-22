import type { BoardConfig } from '@whiteboard/core/config'
import {
  assertDocument,
  type Document
} from '@whiteboard/core/types'
import {
  resolveBoardConfig
} from '../config'
import { normalizeGroups } from './normalize/group'
import { sanitizeDocument } from './normalize/sanitize'

export const normalizeDocument = (
  document: Document,
  configOverrides?: Partial<BoardConfig> | BoardConfig
): Document => {
  const sanitizedDocument = sanitizeDocument(
    assertDocument(document)
  )
  const config = resolveBoardConfig(configOverrides)

  return normalizeGroups({
    document: sanitizedDocument,
    nodeSize: config.nodeSize,
    groupPadding: config.node.groupPadding
  })
}
