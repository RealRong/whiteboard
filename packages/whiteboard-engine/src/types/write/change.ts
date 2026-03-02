import type { Document, Operation, Origin } from '@whiteboard/core/types'
import type { MutationImpact } from './mutation'

export type Change = {
  revision: number
  kind: 'apply' | 'replace'
  origin: Origin
  operations: Operation[]
  impact: MutationImpact
  docBefore: Document
  docAfter: Document
}

export type Bus = {
  publish: (change: Change) => void
  subscribe: (listener: (change: Change) => void) => () => void
}
