import type { Rect } from '@whiteboard/core'

export type SnapAxis = 'x' | 'y'
export type SnapEdge = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY'

export type Guide = {
  axis: SnapAxis
  value: number
  from: number
  to: number
  targetEdge: SnapEdge
  sourceEdge: SnapEdge
}

export type SnapResult = {
  dx?: number
  dy?: number
  guides: Guide[]
  snappedEdges?: {
    x?: { targetEdge: SnapEdge; sourceEdge: SnapEdge }
    y?: { targetEdge: SnapEdge; sourceEdge: SnapEdge }
  }
}

export type SnapCandidate = {
  id: string
  rect: Rect
  lines: {
    left: number
    right: number
    centerX: number
    top: number
    bottom: number
    centerY: number
  }
}

export type GridIndex = {
  cellSize: number
  buckets: Map<string, Set<string>>
  items: Map<string, SnapCandidate>
}
