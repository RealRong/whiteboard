import { useMemo, useSyncExternalStore } from 'react'
import { isPointEqual } from '@whiteboard/core/geometry'
import type { Point } from '@whiteboard/core/types'

export type ConnectionPreview = {
  activePointerId?: number
  from?: Point
  to?: Point
  snap?: Point
  showPreviewLine: boolean
}

export type TransientConnection = {
  get: () => ConnectionPreview
  subscribe: (listener: () => void) => () => void
  write: (preview: ConnectionPreview) => void
  clear: () => void
}

export type ConnectionReader =
  Pick<TransientConnection, 'get' | 'subscribe'>

export type ConnectionWriter =
  Pick<TransientConnection, 'write' | 'clear'>

export const EMPTY_CONNECTION: ConnectionPreview = {
  showPreviewLine: false
}

export const isConnectionPreviewEqual = (
  left: ConnectionPreview,
  right: ConnectionPreview
) => (
  left.activePointerId === right.activePointerId
  && left.showPreviewLine === right.showPreviewLine
  && isPointEqual(left.from, right.from)
  && isPointEqual(left.to, right.to)
  && isPointEqual(left.snap, right.snap)
)

export const useTransientConnection = (
  connection: ConnectionReader
) => {
  const subscribe = useMemo(
    () => connection.subscribe,
    [connection]
  )
  const getSnapshot = useMemo(
    () => connection.get,
    [connection]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_CONNECTION
  )
}

export const createTransientConnection = (
  schedule: () => void
) => {
  let current = EMPTY_CONNECTION
  let pending: ConnectionPreview | undefined
  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((listener) => {
      listener()
    })
  }

  const connection: TransientConnection = {
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
      pending = undefined
      if (isConnectionPreviewEqual(current, EMPTY_CONNECTION)) return
      current = EMPTY_CONNECTION
      notify()
    }
  }

  return {
    connection,
    flush: () => {
      if (pending === undefined || isConnectionPreviewEqual(current, pending)) {
        pending = undefined
        return
      }
      current = pending
      pending = undefined
      notify()
    }
  }
}
