import type { Document } from '@whiteboard/core/types'

export type Store = {
  get: () => Document
  commit: (doc: Document) => void
  notifyChange: (doc: Document) => void
}
