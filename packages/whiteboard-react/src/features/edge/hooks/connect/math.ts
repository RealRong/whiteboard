import { getAnchorFromPoint } from '@whiteboard/core/edge'
import type { EdgeAnchor, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { InternalInstance } from '../../../../runtime/instance'

const ZOOM_EPSILON = 0.0001

export const DEFAULT_EDGE_ANCHOR_OFFSET = 0.5

const readAnchorSnapMinWorld = (
  instance: Pick<InternalInstance, 'config' | 'viewport'>
) => (
  instance.config.edge.anchorSnapMin
  / Math.max(instance.viewport.get().zoom, ZOOM_EPSILON)
)

const resolveAnchorThresholdWorld = (
  instance: Pick<InternalInstance, 'config' | 'viewport'>,
  rect: Pick<Rect, 'width' | 'height'>
) => Math.max(
  readAnchorSnapMinWorld(instance),
  Math.min(rect.width, rect.height) * instance.config.edge.anchorSnapRatio
)

export const resolveAnchorFromPoint = (
  instance: Pick<InternalInstance, 'config' | 'viewport'>,
  rect: Rect,
  rotation: number,
  pointWorld: Point
) => {
  return getAnchorFromPoint(rect, rotation, pointWorld, {
    snapMin: readAnchorSnapMinWorld(instance),
    snapRatio: instance.config.edge.anchorSnapRatio,
    anchorOffset: DEFAULT_EDGE_ANCHOR_OFFSET
  })
}

export type SnapTarget = {
  nodeId: NodeId
  anchor: EdgeAnchor
  pointWorld: Point
}

export const resolveSnapTarget = (
  instance: Pick<InternalInstance, 'config' | 'read' | 'viewport'>,
  pointWorld: Point
): SnapTarget | undefined => {
  const thresholdWorld = resolveAnchorThresholdWorld(instance, instance.config.nodeSize)

  const queryRect: Rect = {
    x: pointWorld.x - thresholdWorld,
    y: pointWorld.y - thresholdWorld,
    width: thresholdWorld * 2,
    height: thresholdWorld * 2
  }
  const nodeIds = instance.read.index.node.idsInRect(queryRect)
  let best: (SnapTarget & { distance: number }) | undefined

  for (let index = 0; index < nodeIds.length; index += 1) {
    const entry = instance.read.index.node.get(nodeIds[index])
    if (!entry) continue
    const candidateThresholdWorld = resolveAnchorThresholdWorld(instance, entry.rect)
    const rect = entry.aabb
    const dx = Math.max(rect.x - pointWorld.x, 0, pointWorld.x - (rect.x + rect.width))
    const dy = Math.max(rect.y - pointWorld.y, 0, pointWorld.y - (rect.y + rect.height))
    if (Math.hypot(dx, dy) > candidateThresholdWorld) continue

    const resolved = resolveAnchorFromPoint(
      instance,
      entry.rect,
      entry.rotation,
      pointWorld
    )
    const distance = Math.hypot(
      resolved.point.x - pointWorld.x,
      resolved.point.y - pointWorld.y
    )
    if (!best || distance < best.distance) {
      best = {
        nodeId: entry.node.id,
        anchor: resolved.anchor,
        pointWorld: resolved.point,
        distance
      }
    }
  }

  if (!best) return undefined
  return {
    nodeId: best.nodeId,
    anchor: best.anchor,
    pointWorld: best.pointWorld
  }
}
