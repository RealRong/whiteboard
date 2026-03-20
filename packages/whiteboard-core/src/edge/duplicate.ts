import type { Edge, EdgeInput, NodeId } from '../types'

const clonePoint = (point: { x: number; y: number }) => ({ x: point.x, y: point.y })

export const createEdgeDuplicateInput = (
  edge: Edge,
  sourceNodeId: NodeId,
  targetNodeId: NodeId
): EdgeInput => ({
  type: edge.type,
  source: edge.source.kind === 'node'
    ? { ...edge.source, nodeId: sourceNodeId }
    : { ...edge.source, point: clonePoint(edge.source.point) },
  target: edge.target.kind === 'node'
    ? { ...edge.target, nodeId: targetNodeId }
    : { ...edge.target, point: clonePoint(edge.target.point) },
  path: edge.path
    ? {
        points: edge.path.points ? edge.path.points.map(clonePoint) : undefined
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
