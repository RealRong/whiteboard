import { getRectsBoundingRect } from '../geometry'
import type {
  EdgeId,
  Node,
  NodeId,
  Rect
} from '../types'
import { getGroupDescendants } from './group'

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export const applySelection = <T>(
  prevSelectedIds: Set<T>,
  ids: T[],
  mode: SelectionMode
): Set<T> => {
  if (mode === 'replace') {
    return new Set(ids)
  }

  const next = new Set(prevSelectedIds)
  if (mode === 'add') {
    ids.forEach((id) => next.add(id))
    return next
  }

  if (mode === 'subtract') {
    ids.forEach((id) => next.delete(id))
    return next
  }

  ids.forEach((id) => {
    if (next.has(id)) {
      next.delete(id)
      return
    }
    next.add(id)
  })
  return next
}

export type TargetBoundsInput = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
  groups?: 'node' | 'content'
}

export const getTargetBounds = ({
  input,
  nodes,
  readNodeBounds,
  readEdgeBounds
}: {
  input: TargetBoundsInput
  nodes: readonly Node[]
  readNodeBounds: (nodeId: NodeId) => Rect | undefined
  readEdgeBounds: (edgeId: EdgeId) => Rect | undefined
}): Rect | undefined => {
  const nodeIds = input.nodeIds ?? []
  const edgeIds = input.edgeIds ?? []
  if (!nodeIds.length && !edgeIds.length) {
    return undefined
  }

  const groupMode = input.groups ?? 'node'
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const rectNodeIds = new Set<NodeId>()
  const rects: Rect[] = []

  const pushNodeRect = (nodeId: NodeId) => {
    if (rectNodeIds.has(nodeId)) {
      return
    }

    const rect = readNodeBounds(nodeId)
    if (!rect) {
      return
    }

    rectNodeIds.add(nodeId)
    rects.push(rect)
  }

  nodeIds.forEach((nodeId) => {
    const node = nodeById.get(nodeId)
    if (!node || groupMode !== 'content' || node.type !== 'group') {
      pushNodeRect(nodeId)
      return
    }

    const descendants = getGroupDescendants(nodes, node.id)
    const content = descendants.filter((descendant) => descendant.type !== 'group')
    if (!content.length) {
      pushNodeRect(node.id)
      return
    }

    content.forEach((descendant) => {
      pushNodeRect(descendant.id)
    })
  })

  edgeIds.forEach((edgeId) => {
    const rect = readEdgeBounds(edgeId)
    if (rect) {
      rects.push(rect)
    }
  })

  return getRectsBoundingRect(rects)
}
