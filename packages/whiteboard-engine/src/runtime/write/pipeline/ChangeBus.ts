import type { MutationImpact } from '../mutation/Impact'
import type { Document, Operation, Origin } from '@whiteboard/core/types'

export type MutationMeta = {
  revision: number
  kind: 'apply' | 'replace'
  origin: Origin
  operations: Operation[]
  impact: MutationImpact
  docBefore: Document
  docAfter: Document
}

export type MutationMetaBus = {
  publish: (meta: MutationMeta) => void
  subscribe: (listener: (meta: MutationMeta) => void) => () => void
}

export const createMutationMetaBus = (): MutationMetaBus => {
  const listeners = new Set<(meta: MutationMeta) => void>()

  return {
    publish: (meta) => {
      if (!listeners.size) return
      listeners.forEach((listener) => {
        listener(meta)
      })
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
