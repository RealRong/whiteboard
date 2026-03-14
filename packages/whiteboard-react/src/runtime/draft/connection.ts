import { isPointEqual } from '@whiteboard/core/geometry'
import type { Point } from '@whiteboard/core/types'
import { createValueDraftStore, useValueDraft } from './shared/valueStore'

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
) => useValueDraft(connection, () => EMPTY_CONNECTION)

export const createTransientConnection = (
  schedule: () => void
) => {
  const { flush, ...connection } = createValueDraftStore({
    schedule,
    initialValue: EMPTY_CONNECTION,
    isEqual: isConnectionPreviewEqual
  })

  return {
    connection,
    flush
  }
}
