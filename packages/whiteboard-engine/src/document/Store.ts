import type { Document } from '@whiteboard/core/types'

export type DocumentStore = {
  get: () => Document
  replace: (doc: Document, options?: { silent?: boolean }) => void
}

export const createDocumentStore = (
  initial: Document,
  onChange?: (doc: Document) => void
): DocumentStore => {
  let current = initial

  return {
    get: () => current,
    replace: (doc, options) => {
      current = doc
      if (!options?.silent) {
        onChange?.(doc)
      }
    }
  }
}
