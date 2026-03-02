import type { Document } from '@whiteboard/core/types'
import type { Store as DocumentStore } from '@engine-types/document/store'

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
