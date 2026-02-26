import type { PointerInput } from '@engine-types/common'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { NodeDragChildren, NodeDragDraft } from '@engine-types/node'
import type { Guide } from '@engine-types/node/snap'
import type { NodePreviewUpdate } from '@engine-types/state'
import type { Node, NodeId, Point, Rect } from '@whiteboard/core/types'
import { computeSnap, findSmallestGroupAtPoint, getGroupDescendants } from '@whiteboard/core/node'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../../config'

type MoveOptions = {
  nodeId: NodeId
  position: Point
  size: { width: number; height: number }
  childrenIds?: NodeId[]
  snapEnabled: boolean
  allowCross: boolean
}

type RulesOptions = {
  config: InstanceConfig
  query: Pick<Query, 'snap'>
  readZoom: () => number
  readCanvasNodes: () => Node[]
}

const resolveInteractionZoom = (zoom: number) =>
  Math.max(zoom, DEFAULT_INTERNALS.zoomEpsilon)

const resolveSnapThresholdWorld = (
  config: InstanceConfig['node'],
  zoom: number
) =>
  Math.min(
    config.snapThresholdScreen / resolveInteractionZoom(zoom),
    config.snapMaxThresholdWorld
  )

const expandRectByThreshold = (
  rect: Rect,
  thresholdWorld: number
): Rect => ({
  x: rect.x - thresholdWorld,
  y: rect.y - thresholdWorld,
  width: rect.width + thresholdWorld * 2,
  height: rect.height + thresholdWorld * 2
})

export class Rules {
  private readonly config: RulesOptions['config']
  private readonly query: RulesOptions['query']
  private readonly readZoom: RulesOptions['readZoom']
  private readonly readCanvasNodes: RulesOptions['readCanvasNodes']

  constructor(options: RulesOptions) {
    this.config = options.config
    this.query = options.query
    this.readZoom = options.readZoom
    this.readCanvasNodes = options.readCanvasNodes
  }

  buildGroupChildren = (
    nodes: Node[],
    nodeId: NodeId,
    origin: Point
  ): NodeDragChildren | undefined => {
    const ids = getGroupDescendants(nodes, nodeId).map((child) => child.id)
    if (!ids.length) return undefined

    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const offsets = new Map<NodeId, Point>()
    ids.forEach((childId) => {
      const childNode = nodeById.get(childId)
      if (!childNode) return
      offsets.set(childId, {
        x: childNode.position.x - origin.x,
        y: childNode.position.y - origin.y
      })
    })

    return {
      ids,
      offsets
    }
  }

  resolvePosition = (
    draft: NodeDragDraft,
    pointer: PointerInput
  ): Point => {
    const zoom = resolveInteractionZoom(this.readZoom())
    return {
      x: draft.origin.x + (pointer.client.x - draft.start.x) / zoom,
      y: draft.origin.y + (pointer.client.y - draft.start.y) / zoom
    }
  }

  resolveMove = ({
    nodeId,
    position,
    size,
    childrenIds,
    snapEnabled,
    allowCross
  }: MoveOptions): {
    position: Point
    guides: Guide[]
  } => {
    if (!snapEnabled) {
      return {
        position,
        guides: []
      }
    }

    const thresholdWorld = resolveSnapThresholdWorld(
      this.config.node,
      this.readZoom()
    )
    const movingRect: Rect = {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height
    }
    const queryRect = expandRectByThreshold(movingRect, thresholdWorld)
    const exclude = childrenIds?.length
      ? new Set([nodeId, ...childrenIds])
      : new Set([nodeId])

    const candidates = this.query.snap.candidatesInRect(queryRect)
      .filter((candidate) => !exclude.has(candidate.id as NodeId))

    const snapResult = computeSnap(
      movingRect,
      candidates,
      thresholdWorld,
      nodeId,
      {
        allowCross,
        crossThreshold:
          thresholdWorld * DEFAULT_TUNING.nodeDrag.snapCrossThresholdRatio
      }
    )

    return {
      position: {
        x:
          snapResult.dx !== undefined
            ? position.x + snapResult.dx
            : position.x,
        y:
          snapResult.dy !== undefined
            ? position.y + snapResult.dy
            : position.y
      },
      guides: snapResult.guides
    }
  }

  resolveHoveredGroup = (
    nodeId: NodeId,
    size: { width: number; height: number },
    position: Point
  ): NodeId | undefined => {
    const center = {
      x: position.x + size.width / 2,
      y: position.y + size.height / 2
    }
    return findSmallestGroupAtPoint(
      this.readCanvasNodes(),
      this.config.nodeSize,
      center,
      nodeId
    )?.id
  }

  buildGroupUpdates = (
    draft: NodeDragDraft,
    position: Point
  ): NodePreviewUpdate[] => {
    const updates: NodePreviewUpdate[] = [{
      id: draft.nodeId,
      position
    }]

    draft.children?.ids.forEach((childId) => {
      const offset = draft.children?.offsets.get(childId)
      if (!offset) return
      updates.push({
        id: childId,
        position: {
          x: position.x + offset.x,
          y: position.y + offset.y
        }
      })
    })

    return updates
  }
}
