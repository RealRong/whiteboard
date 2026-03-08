import type { Atoms as StoreAtoms } from '@engine-types/internal/store'
import type { Viewport } from '@whiteboard/core/types'
import { assertDocument, type Document } from '@whiteboard/core/types'
import { isSameViewport } from '@whiteboard/core/geometry'
import type { createStore } from 'jotai/vanilla'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../config'

const assertImmutableDocumentInput = (
  currentDocument: Document,
  nextDocument: Document
) => {
  if (currentDocument !== nextDocument) return
  throw new Error(
    'Whiteboard engine requires immutable document inputs. Received the same document reference.'
  )
}

const resolveCommittedViewport = (viewport?: Viewport): Viewport => (
  viewport ?? DEFAULT_DOCUMENT_VIEWPORT
)

const copyViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

export type DocumentRuntime = {
  document: {
    get: () => Document
    commit: (doc: Document) => void
  }
  viewport: {
    get: () => Viewport
    set: (viewport?: Viewport) => void
  }
}

export const createDocumentRuntime = ({
  store,
  stateAtoms
}: {
  store: ReturnType<typeof createStore>
  stateAtoms: StoreAtoms
}): DocumentRuntime => {
  const getDocument = (): Document => store.get(stateAtoms.document)
  const getViewport = (): Viewport => store.get(stateAtoms.viewport)

  const setViewport = (nextViewport?: Viewport) => {
    const resolvedViewport = resolveCommittedViewport(nextViewport)
    if (isSameViewport(getViewport(), resolvedViewport)) return
    store.set(stateAtoms.viewport, copyViewport(resolvedViewport))
  }

  const commitDocument = (nextDocument: Document) => {
    const committedDocument = assertDocument(nextDocument)
    const currentDocument = getDocument()
    assertImmutableDocumentInput(currentDocument, committedDocument)
    store.set(stateAtoms.document, committedDocument)
    setViewport(committedDocument.viewport)
  }

  return {
    document: {
      get: getDocument,
      commit: commitDocument
    },
    viewport: {
      get: getViewport,
      set: setViewport
    }
  }
}
