import { isPointEqual } from '../geometry'
import type {
  Edge,
  EdgeEnd,
  EdgeId,
  EdgePatch,
  Point
} from '../types'

export type EdgeProjectionHint = {
  line?: {
    from: Point
    to: Point
  }
  snap?: Point
}

export type EdgeProjectionPatch = {
  source?: Edge['source']
  target?: Edge['target']
  route?: Edge['route']
  activeRouteIndex?: number
}

export type EdgeProjectionPatchEntry =
  EdgeProjectionPatch & {
    id: EdgeId
  }

export const EMPTY_EDGE_PROJECTION_PATCH: EdgeProjectionPatch = {}

const isEdgeEndPatchEqual = (
  left: EdgeEnd | undefined,
  right: EdgeEnd | undefined
) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return left === right
  }
  if (left.kind !== right.kind) {
    return false
  }
  if (left.kind === 'point' && right.kind === 'point') {
    return isPointEqual(left.point, right.point)
  }
  if (left.kind === 'node' && right.kind === 'node') {
    return left.nodeId === right.nodeId
      && left.anchor?.side === right.anchor?.side
      && left.anchor?.offset === right.anchor?.offset
  }
  return false
}

export const isEdgeProjectionHintEqual = (
  left: EdgeProjectionHint,
  right: EdgeProjectionHint
) => (
  isPointEqual(left.line?.from, right.line?.from)
  && isPointEqual(left.line?.to, right.line?.to)
  && isPointEqual(left.snap, right.snap)
)

export const isEdgeProjectionPatchEqual = (
  left: EdgeProjectionPatch,
  right: EdgeProjectionPatch
) => (
  isEdgeEndPatchEqual(left.source, right.source)
  && isEdgeEndPatchEqual(left.target, right.target)
  && left.route === right.route
  && left.activeRouteIndex === right.activeRouteIndex
)

export const toEdgeProjectionPatchEntry = (
  edgeId: EdgeId,
  patch: EdgePatch,
  activeRouteIndex?: number
): EdgeProjectionPatchEntry => ({
  id: edgeId,
  source: patch.source,
  target: patch.target,
  route: patch.route,
  activeRouteIndex
})

export const applyEdgeProjectionPatch = (
  edge: Edge,
  patch: EdgeProjectionPatch
): Edge => {
  let next = edge

  if (patch.source && patch.source !== next.source) {
    next = {
      ...next,
      source: patch.source
    }
  }

  if (patch.target && patch.target !== next.target) {
    next = {
      ...next,
      target: patch.target
    }
  }

  if (patch.route && patch.route !== next.route) {
    next = {
      ...next,
      route:
        patch.route.kind === 'manual'
          ? {
              kind: 'manual',
              points: [...patch.route.points]
            }
          : {
              kind: 'auto'
            }
    }
  }

  return next
}
