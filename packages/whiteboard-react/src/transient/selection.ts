import { useMemo, useSyncExternalStore } from 'react'
import type { Rect } from '@whiteboard/core/types'

export type TransientSelection = {
  get: () => Rect | undefined
  subscribe: (listener: () => void) => () => void
  write: (rect: Rect | undefined) => void
  clear: () => void
}

export type SelectionReader =
  Pick<TransientSelection, 'get' | 'subscribe'>

export type SelectionWriter =
  Pick<TransientSelection, 'write' | 'clear'>

const isSameRect = (
  left: Rect | undefined,
  right: Rect | undefined
) => (
  left === right
  || (
    left?.x === right?.x
    && left?.y === right?.y
    && left?.width === right?.width
    && left?.height === right?.height
  )
)

export const useTransientSelection = (
  selection: SelectionReader
) => {
  const subscribe = useMemo(
    () => selection.subscribe,
    [selection]
  )
  const getSnapshot = useMemo(
    () => selection.get,
    [selection]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => undefined
  )
}

export { isSameRect as isSelectionRectEqual }

export const createTransientSelection = (
  schedule: () => void
) => {
  let current: Rect | undefined
  let pending: Rect | undefined | null = null
  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((listener) => {
      listener()
    })
  }

  const selection: TransientSelection = {
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
    selection,
    flush: () => {
      if (pending === null || isSameRect(current, pending ?? undefined)) {
        pending = null
        return
      }
      current = pending ?? undefined
      pending = null
      notify()
    }
  }
}
