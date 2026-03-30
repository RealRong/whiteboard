import {
  resolveEdgeConnectQueryRect,
  resolveEdgeConnectTarget,
  type EdgeConnectCandidate,
  type EdgeConnectConfig,
  type EdgeConnectResult
} from '@whiteboard/core/edge'
import {
  computeResizeSnap,
  computeSnap,
  expandRectByThreshold,
  resolveSnapThresholdWorld,
  type Guide,
  type HorizontalResizeEdge,
  type ResizeUpdate,
  type SnapCandidate,
  type SnapThresholdConfig,
  type VerticalResizeEdge
} from '@whiteboard/core/node'
import {
  createRafValueStore,
  type ReadStore
} from '@whiteboard/engine'
import type { Point, Rect, Size } from '@whiteboard/core/types'

const EMPTY_GUIDES: readonly Guide[] = []
const DEFAULT_MIN_SIZE: Size = {
  width: 20,
  height: 20
}

export type ResizeSnapSource = {
  x?: HorizontalResizeEdge
  y?: VerticalResizeEdge
}

export type MoveSnapInput = {
  rect: Rect
  excludeIds?: readonly string[]
  allowCross?: boolean
  disabled?: boolean
}

export type ResizeSnapInput = {
  rect: Rect
  source: ResizeSnapSource
  minSize?: Size
  excludeIds?: readonly string[]
  disabled?: boolean
}

export type NodeSnapRuntime = {
  guides: ReadStore<readonly Guide[]>
  clear: () => void
  move: (input: MoveSnapInput) => Rect
  resize: (input: ResizeSnapInput) => ResizeUpdate
}

export type EdgeSnapRuntime = {
  connect: (pointWorld: Point) => EdgeConnectResult | undefined
}

export type SnapRuntime = {
  node: NodeSnapRuntime
  edge: EdgeSnapRuntime
}

const toResizeUpdate = (
  rect: Rect
): ResizeUpdate => ({
  position: {
    x: rect.x,
    y: rect.y
  },
  size: {
    width: rect.width,
    height: rect.height
  }
})

const filterCandidates = (
  candidates: readonly SnapCandidate[],
  excludeIds?: readonly string[]
) => {
  if (!excludeIds?.length) {
    return [...candidates]
  }

  const exclude = new Set(excludeIds)
  return candidates.filter((candidate) => !exclude.has(candidate.id))
}

const createNodeSnapRuntime = ({
  config,
  readZoom,
  query
}: {
  config: SnapThresholdConfig
  readZoom: () => number
  query: (rect: Rect) => readonly SnapCandidate[]
}): NodeSnapRuntime => {
  const guides = createRafValueStore({
    initial: EMPTY_GUIDES,
    isEqual: (left, right) => left === right
  })

  const writeGuides = (next: readonly Guide[]) => {
    guides.write(next.length ? next : EMPTY_GUIDES)
  }

  const clear = () => {
    guides.clear()
  }

  const readThreshold = () => resolveSnapThresholdWorld(
    config,
    readZoom()
  )

  return {
    guides: {
      get: guides.get,
      subscribe: guides.subscribe
    },
    clear,
    move: ({
      rect,
      excludeIds,
      allowCross = false,
      disabled = false
    }) => {
      if (disabled) {
        clear()
        return rect
      }

      const threshold = readThreshold()
      const result = computeSnap(
        rect,
        filterCandidates(
          query(expandRectByThreshold(rect, threshold)),
          excludeIds
        ),
        threshold,
        undefined,
        { allowCross }
      )

      writeGuides(result.guides)

      return {
        x: rect.x + (result.dx ?? 0),
        y: rect.y + (result.dy ?? 0),
        width: rect.width,
        height: rect.height
      }
    },
    resize: ({
      rect,
      source,
      minSize = DEFAULT_MIN_SIZE,
      excludeIds,
      disabled = false
    }) => {
      if (disabled || (!source.x && !source.y)) {
        clear()
        return toResizeUpdate(rect)
      }

      const threshold = readThreshold()
      const result = computeResizeSnap({
        movingRect: rect,
        candidates: filterCandidates(
          query(expandRectByThreshold(rect, threshold)),
          excludeIds
        ),
        threshold,
        minSize,
        sourceEdges: {
          sourceX: source.x,
          sourceY: source.y
        }
      })

      writeGuides(result.guides)
      return toResizeUpdate(result.rect)
    }
  }
}

const createEdgeSnapRuntime = ({
  config,
  nodeSize,
  readZoom,
  query
}: {
  config: EdgeConnectConfig
  nodeSize: Size
  readZoom: () => number
  query: (rect: Rect) => readonly EdgeConnectCandidate[]
}): EdgeSnapRuntime => ({
  connect: (pointWorld) => {
    const zoom = readZoom()
    return resolveEdgeConnectTarget({
      pointWorld,
      candidates: query(
        resolveEdgeConnectQueryRect(pointWorld, zoom, config, nodeSize)
      ),
      zoom,
      config
    })
  }
})

export const createSnapRuntime = ({
  readZoom,
  node,
  edge
}: {
  readZoom: () => number
  node: {
    config: SnapThresholdConfig
    query: (rect: Rect) => readonly SnapCandidate[]
  }
  edge: {
    config: EdgeConnectConfig
    nodeSize: Size
    query: (rect: Rect) => readonly EdgeConnectCandidate[]
  }
}): SnapRuntime => ({
  node: createNodeSnapRuntime({
    config: node.config,
    readZoom,
    query: node.query
  }),
  edge: createEdgeSnapRuntime({
    config: edge.config,
    nodeSize: edge.nodeSize,
    readZoom,
    query: edge.query
  })
})
