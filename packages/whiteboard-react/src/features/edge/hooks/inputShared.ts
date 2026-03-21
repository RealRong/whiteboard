import type { EdgeItem } from '@whiteboard/core/read'
import type {
  EdgeAnchor,
  EdgeEnd,
  EdgeId,
  EdgePatch,
  Point
} from '@whiteboard/core/types'
import type { ViewportPointer } from '../../../runtime/viewport'
import type { EdgeDraftEnd } from '../../../types/edge'

export type ConnectHandleSide = EdgeAnchor['side']

export type ConnectPointer = ViewportPointer & {
  pointerId: number
}

export type PointerSourceEvent = {
  pointerId: number
  clientX: number
  clientY: number
  button: number
  detail: number
  shiftKey: boolean
  target: EventTarget | null
  currentTarget: EventTarget | null
  preventDefault: () => void
  stopPropagation: () => void
}

export const toEdgeEnd = (
  value: EdgeDraftEnd
): EdgeEnd => (
  value.kind === 'node'
    ? {
        kind: 'node',
        nodeId: value.nodeId,
        anchor: value.anchor
      }
    : {
        kind: 'point',
        point: value.point
      }
)

export const toPathPatch = (
  points: readonly Point[]
): EdgePatch => ({
  path: {
    points: [...points]
  }
})

export const toSessionPatch = (
  edgeId: EdgeId,
  patch: EdgePatch,
  activePathIndex?: number
) => ({
  id: edgeId,
  source: patch.source,
  target: patch.target,
  pathPoints: patch.path?.points,
  activePathIndex
})

export const canMoveEdge = (
  edge: EdgeItem['edge']
) => (
  edge.source.kind === 'point'
  && edge.target.kind === 'point'
)

export const readCaptureTarget = (
  event: PointerSourceEvent
): Element | null => (
  event.currentTarget instanceof Element
    ? event.currentTarget
    : event.target instanceof Element
      ? event.target
      : null
)
