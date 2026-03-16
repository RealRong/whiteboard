import { isPointEqual } from '@whiteboard/core/geometry'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import type { Point } from '@whiteboard/core/types'
import { useStoreValue } from '../../../runtime/hooks'

type EdgeConnectPreview = {
  activePointerId?: number
  from?: Point
  to?: Point
  snap?: Point
  showPreviewLine: boolean
}

export type EdgeConnectSessionStore =
  Pick<StagedValueStore<EdgeConnectPreview>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type EdgeConnectSessionReader =
  Pick<EdgeConnectSessionStore, 'get' | 'subscribe'>

const EMPTY_EDGE_CONNECT_PREVIEW: EdgeConnectPreview = {
  showPreviewLine: false
}

const isEdgeConnectPreviewEqual = (
  left: EdgeConnectPreview,
  right: EdgeConnectPreview
) => (
  left.activePointerId === right.activePointerId
  && left.showPreviewLine === right.showPreviewLine
  && isPointEqual(left.from, right.from)
  && isPointEqual(left.to, right.to)
  && isPointEqual(left.snap, right.snap)
)

export const createEdgeConnectSessionStore = (
  schedule: () => void
) => createStagedValueStore({
  schedule,
  initial: EMPTY_EDGE_CONNECT_PREVIEW,
  isEqual: isEdgeConnectPreviewEqual
})

export const useEdgeConnectSession = (
  store: EdgeConnectSessionReader
) => useStoreValue(store)
