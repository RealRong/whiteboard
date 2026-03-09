import type { DocumentSource } from '@engine-types/instance'
import {
  assertDocument,
  type Document,
  type Viewport
} from '@whiteboard/core/types'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../config'

const readViewport = (document: Document): Viewport => (
  document.viewport ?? DEFAULT_DOCUMENT_VIEWPORT
)

const isSameViewport = (left: Viewport, right: Viewport) => (
  left === right || (
    left.zoom === right.zoom
    && left.center.x === right.center.x
    && left.center.y === right.center.y
  )
)

const assertImmutableDocumentInput = (
  currentDocument: Document,
  nextDocument: Document
) => {
  if (currentDocument !== nextDocument) return
  throw new Error(
    'Whiteboard engine requires immutable document inputs. Received the same document reference.'
  )
}

export const createDocumentSource = (document: Document): DocumentSource => {
  let committedDocument = assertDocument(document)
  const viewportListeners = new Set<() => void>()

  const get = () => committedDocument

  const commit = (nextDocument: Document) => {
    const committedNextDocument = assertDocument(nextDocument)
    assertImmutableDocumentInput(committedDocument, committedNextDocument)

    const previousViewport = readViewport(committedDocument)
    committedDocument = committedNextDocument
    const nextViewport = readViewport(committedDocument)

    if (!isSameViewport(previousViewport, nextViewport)) {
      viewportListeners.forEach((listener) => {
        listener()
      })
    }
  }

  const subscribeViewport = (listener: () => void) => {
    viewportListeners.add(listener)
    return () => {
      viewportListeners.delete(listener)
    }
  }

  return {
    get,
    commit,
    subscribeViewport
  }
}
