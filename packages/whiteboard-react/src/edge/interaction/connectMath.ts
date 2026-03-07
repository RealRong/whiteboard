import { getAnchorFromPoint } from '@whiteboard/core/edge'
import { getAnchorPoint } from '@whiteboard/core/geometry'
import type { EdgeAnchor, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { EdgeConnectDraft, Instance } from '@whiteboard/engine'

const ZOOM_EPSILON = 0.0001

export const DEFAULT_EDGE_ANCHOR_OFFSET = 0.5

export const resolveAnchorFromPoint = (
  instance: Instance,
  rect: Rect,
  rotation: number,
  pointWorld: Point
) => {
  const config = instance.read.config
  return getAnchorFromPoint(rect, rotation, pointWorld, {
    snapMin: config.edge.anchorSnapMin,
    snapRatio: config.edge.anchorSnapRatio,
    anchorOffset: DEFAULT_EDGE_ANCHOR_OFFSET
  })
}

export type SnapTarget = {
  nodeId: NodeId
  anchor: EdgeAnchor
  pointWorld: Point
}

type ConnectPointInput = {
  nodeId?: EdgeConnectDraft['from']['nodeId']
  anchor?: EdgeConnectDraft['from']['anchor']
  pointWorld?: NonNullable<EdgeConnectDraft['to']>['pointWorld']
}

const resolveConnectPoint = (
  instance: Instance,
  value: ConnectPointInput | undefined,
  allowPointWorld: boolean
): Point | undefined => {
  if (!value) return undefined
  if (value.nodeId && value.anchor) {
    const entry = instance.read.index.nodeRect(value.nodeId)
    if (entry) {
      return getAnchorPoint(entry.rect, value.anchor, entry.rotation)
    }
    if (!allowPointWorld) return undefined
  }
  if (!allowPointWorld) return undefined
  return value.pointWorld
}

export const resolveSnapTarget = (
  instance: Instance,
  pointWorld: Point
): SnapTarget | undefined => {
  const config = instance.read.config
  const zoom = instance.read.viewport.getZoom()
  const thresholdWorld =
    Math.max(
      config.edge.anchorSnapMin,
      Math.min(config.nodeSize.width, config.nodeSize.height) * config.edge.anchorSnapRatio
    ) / Math.max(zoom, ZOOM_EPSILON)

  const nodeRects = instance.read.index.nodeRects()
  let best: (SnapTarget & { distance: number }) | undefined

  for (let index = 0; index < nodeRects.length; index += 1) {
    const entry = nodeRects[index]
    const rect = entry.aabb
    const dx = Math.max(rect.x - pointWorld.x, 0, pointWorld.x - (rect.x + rect.width))
    const dy = Math.max(rect.y - pointWorld.y, 0, pointWorld.y - (rect.y + rect.height))
    if (Math.hypot(dx, dy) > thresholdWorld) continue

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

export type ConnectPreviewModel = {
  from?: Point
  to?: Point
  snap?: Point
  showPreviewLine: boolean
}

export const resolveConnectPreview = (
  instance: Instance,
  draft: EdgeConnectDraft
): ConnectPreviewModel => {
  const from = resolveConnectPoint(instance, draft.from, false)
  const to = resolveConnectPoint(instance, draft.to, true)
  const snap =
    draft.to?.nodeId && draft.to.anchor
      ? resolveConnectPoint(instance, draft.to, true)
      : undefined

  return {
    from,
    to,
    snap,
    showPreviewLine: Boolean(!draft.reconnect && from && to)
  }
}
