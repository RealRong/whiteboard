import { isPointEqual } from '@whiteboard/core/geometry'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import type { Point } from '@whiteboard/core/types'
import { useStoreValue } from '../hooks'

type ConnectionPreview = {
  activePointerId?: number
  from?: Point
  to?: Point
  snap?: Point
  showPreviewLine: boolean
}

export type ConnectionDraftStore =
  Pick<StagedValueStore<ConnectionPreview>, 'get' | 'subscribe' | 'write' | 'clear'>

export type ConnectionReader =
  Pick<ConnectionDraftStore, 'get' | 'subscribe'>

export type ConnectionWriter =
  Pick<ConnectionDraftStore, 'write' | 'clear'>

const EMPTY_CONNECTION: ConnectionPreview = {
  showPreviewLine: false
}

const isConnectionPreviewEqual = (
  left: ConnectionPreview,
  right: ConnectionPreview
) => (
  left.activePointerId === right.activePointerId
  && left.showPreviewLine === right.showPreviewLine
  && isPointEqual(left.from, right.from)
  && isPointEqual(left.to, right.to)
  && isPointEqual(left.snap, right.snap)
)

export const useConnectionDraft = (
  connection: ConnectionReader
) => useStoreValue(connection)

export const createConnectionDraftStore = (
  schedule: () => void
) => {
  const { flush, ...connection } = createStagedValueStore({
    schedule,
    initial: EMPTY_CONNECTION,
    isEqual: isConnectionPreviewEqual
  })

  return {
    connection,
    flush
  }
}
