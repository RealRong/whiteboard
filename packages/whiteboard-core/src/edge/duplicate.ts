import type { Edge, EdgeInput, NodeId } from '../types'

const clonePoint = (point: { x: number; y: number }) => ({ x: point.x, y: point.y })

export const createEdgeDuplicateInput = (
  edge: Edge,
  sourceNodeId: NodeId,
  targetNodeId: NodeId
): EdgeInput => ({
  type: edge.type,
  source: { ...edge.source, nodeId: sourceNodeId },
  target: { ...edge.target, nodeId: targetNodeId },
  routing: edge.routing
    ? {
        ...edge.routing,
        points: edge.routing.points ? edge.routing.points.map(clonePoint) : undefined
      }
    : undefined,
  style: edge.style ? { ...edge.style } : undefined,
  label: edge.label
    ? {
        ...edge.label,
        offset: edge.label.offset ? clonePoint(edge.label.offset) : undefined
      }
    : undefined,
  data: edge.data ? { ...edge.data } : undefined
})
