import type { Document } from '@whiteboard/core/types'

export type Store = {
  get: () => Document
  replace: (doc: Document, options?: { silent?: boolean }) => void
}
