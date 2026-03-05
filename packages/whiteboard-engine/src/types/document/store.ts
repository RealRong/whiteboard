import type { Document } from '@whiteboard/core/types'

export type Store = {
  get: () => Document
  set: (doc: Document) => void
  notifyChange: (doc: Document) => void
}
