import type { MutationImpact } from '../mutation/Impact'
import type { Document, Operation, Origin } from '@whiteboard/core/types'

export type Change = {
  revision: number
  kind: 'apply' | 'replace'
  origin: Origin
  operations: Operation[]
  impact: MutationImpact
  docBefore: Document
  docAfter: Document
}

export type ChangeBus = {
  publish: (change: Change) => void
  subscribe: (listener: (change: Change) => void) => () => void
}

export const createChangeBus = (): ChangeBus => {
  const listeners = new Set<(change: Change) => void>()

  return {
    publish: (change) => {
      if (!listeners.size) return
      listeners.forEach((listener) => {
        listener(change)
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
