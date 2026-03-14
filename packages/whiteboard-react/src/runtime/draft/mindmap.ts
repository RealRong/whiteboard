import { useMemo, useSyncExternalStore } from 'react'
import type { MindmapDragView } from '@whiteboard/engine'

export type TransientMindmap = {
  get: () => MindmapDragView | undefined
  subscribe: (listener: () => void) => () => void
  write: (drag: MindmapDragView | undefined) => void
  clear: () => void
}

export type MindmapReader =
  Pick<TransientMindmap, 'get' | 'subscribe'>

export type MindmapWriter =
  Pick<TransientMindmap, 'write' | 'clear'>

export const useTransientMindmap = (
  mindmap: MindmapReader
) => {
  const subscribe = useMemo(
    () => mindmap.subscribe,
    [mindmap]
  )
  const getSnapshot = useMemo(
    () => mindmap.get,
    [mindmap]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => undefined
  )
}

export const createTransientMindmap = (
  schedule: () => void
) => {
  let current: MindmapDragView | undefined
  let pending: MindmapDragView | undefined | null = null
  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((listener) => {
      listener()
    })
  }

  const mindmap: TransientMindmap = {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    write: (next) => {
      pending = next
      schedule()
    },
    clear: () => {
      pending = null
      if (current === undefined) return
      current = undefined
      notify()
    }
  }

  return {
    mindmap,
    flush: () => {
      if (pending === null || current === pending) {
        pending = null
        return
      }
      current = pending ?? undefined
      pending = null
      notify()
    }
  }
}
