import type { Edge, EdgeAnchor, NodeId, Point, Rect } from '@whiteboard/core'
import type { Size } from '@engine-types/common'

const toNumberToken = (value: number | undefined | null) => {
  if (value === undefined || value === null) return ''
  return Number.isFinite(value) ? `${value}` : ''
}

export const toPointSignature = (point?: Point) => {
  if (!point) return 'none'
  return `${toNumberToken(point.x)}:${toNumberToken(point.y)}`
}

export const toRectSignature = (rect?: Rect) => {
  if (!rect) return 'none'
  return `${toNumberToken(rect.x)}:${toNumberToken(rect.y)}:${toNumberToken(rect.width)}:${toNumberToken(rect.height)}`
}

export const toAnchorSignature = (anchor?: EdgeAnchor) => {
  if (!anchor) return 'auto'
  return `${anchor.side}:${toNumberToken(anchor.offset)}`
}

export const toNodeGeometrySignature = (entry?: { rect: Rect; rotation: number }) => {
  if (!entry) return 'missing'
  return `${toRectSignature(entry.rect)}:${toNumberToken(entry.rotation)}`
}

export const toEdgeRoutingSignature = (edge: Edge) => {
  const routing = edge.routing
  if (!routing) return ''
  const mode = routing.mode ?? ''
  const orthoOffset = toNumberToken(routing.ortho?.offset)
  const orthoRadius = toNumberToken(routing.ortho?.radius)
  const points = routing.points?.map((point) => toPointSignature(point)).join(';') ?? ''
  return `${mode}|${orthoOffset}|${orthoRadius}|${points}`
}

export const toEdgePathSignature = (edge: Edge, getNodeGeometrySignature: (nodeId: NodeId) => string) =>
  [
    edge.type,
    toEdgeRoutingSignature(edge),
    edge.source.nodeId,
    toAnchorSignature(edge.source.anchor),
    getNodeGeometrySignature(edge.source.nodeId),
    edge.target.nodeId,
    toAnchorSignature(edge.target.anchor),
    getNodeGeometrySignature(edge.target.nodeId)
  ].join('#')

type MindmapLayoutSignatureInput = {
  treeId: string
  structureSignature: string
  nodeSize: Size
  mode: string
  hGap?: number
  vGap?: number
  side?: string
}

export const toMindmapLayoutSignature = ({
  treeId,
  structureSignature,
  nodeSize,
  mode,
  hGap,
  vGap,
  side
}: MindmapLayoutSignatureInput) =>
  [
    treeId,
    structureSignature,
    mode,
    toNumberToken(nodeSize.width),
    toNumberToken(nodeSize.height),
    toNumberToken(hGap),
    toNumberToken(vGap),
    side ?? ''
  ].join('#')
