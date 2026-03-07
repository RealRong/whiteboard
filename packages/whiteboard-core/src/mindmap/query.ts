import {
  type MindmapLayout,
  type MindmapId,
  type MindmapNode,
  type MindmapNodeId,
  type MindmapTree
} from './types'
import { layoutMindmap, layoutMindmapTidy } from './layout'
import { getMindmapTreeFromNode } from './helpers'
import { cloneValue } from '../utils'
import type { MindmapLayoutHint, Node, Operation, Size } from '../types/core'

export type MindmapViewLine = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type MindmapInsertPlacement = 'left' | 'right' | 'up' | 'down'

export type MindmapInsertPlan =
  | {
      mode: 'child'
      parentId: MindmapNodeId
      index?: number
      side?: 'left' | 'right'
    }
  | {
      mode: 'sibling'
      nodeId: MindmapNodeId
      position: 'before' | 'after'
    }
  | {
      mode: 'towardRoot'
      nodeId: MindmapNodeId
    }

export type MindmapLayoutConfigLike = {
  mode?: 'simple' | 'tidy'
  options?: {
    hGap?: number
    vGap?: number
    side?: 'left' | 'right' | 'both'
  }
}

const computeConnectionLine = (
  parent: { x: number; y: number; width: number; height: number },
  child: { x: number; y: number; width: number; height: number },
  side?: 'left' | 'right'
) => {
  const parentCenterX = parent.x + parent.width / 2
  const parentCenterY = parent.y + parent.height / 2
  const childCenterY = child.y + child.height / 2
  if (side === 'left') {
    return {
      x1: parent.x,
      y1: parentCenterY,
      x2: child.x + child.width,
      y2: childCenterY
    }
  }
  if (side === 'right') {
    return {
      x1: parent.x + parent.width,
      y1: parentCenterY,
      x2: child.x,
      y2: childCenterY
    }
  }
  const childCenterX = child.x + child.width / 2
  if (childCenterX >= parentCenterX) {
    return {
      x1: parent.x + parent.width,
      y1: parentCenterY,
      x2: child.x,
      y2: childCenterY
    }
  }
  return {
    x1: parent.x,
    y1: parentCenterY,
    x2: child.x + child.width,
    y2: childCenterY
  }
}

export const getSubtreeIds = (tree: MindmapTree, rootId: MindmapNodeId) => {
  const result: MindmapNodeId[] = []
  const stack: MindmapNodeId[] = [rootId]
  const visited = new Set<MindmapNodeId>()
  while (stack.length) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    result.push(current)
    const children = tree.children[current] ?? []
    children.forEach((childId) => stack.push(childId))
  }
  return result
}

export const getSide = (tree: MindmapTree, nodeId: MindmapNodeId): 'left' | 'right' | undefined => {
  if (nodeId === tree.rootId) return
  let current: MindmapNodeId | undefined = nodeId
  while (current) {
    const parent: MindmapNodeId | undefined = tree.nodes[current]?.parentId
    if (!parent) return
    if (parent === tree.rootId) {
      return tree.nodes[current]?.side
    }
    current = parent
  }
}

export const resolveInsertPlan = ({
  tree,
  targetNodeId,
  placement,
  layoutSide,
  defaultSide = 'right'
}: {
  tree: MindmapTree
  targetNodeId: MindmapNodeId
  placement: MindmapInsertPlacement
  layoutSide?: 'left' | 'right' | 'both'
  defaultSide?: 'left' | 'right'
}): MindmapInsertPlan => {
  if (targetNodeId === tree.rootId) {
    const children = tree.children[targetNodeId] ?? []
    const index = placement === 'up' ? 0 : placement === 'down' ? children.length : undefined
    const side =
      placement === 'left'
        ? 'left'
        : placement === 'right'
          ? 'right'
          : layoutSide === 'left' || layoutSide === 'right'
            ? layoutSide
            : defaultSide
    return {
      mode: 'child',
      parentId: targetNodeId,
      index,
      side
    }
  }

  if (placement === 'up' || placement === 'down') {
    return {
      mode: 'sibling',
      nodeId: targetNodeId,
      position: placement === 'up' ? 'before' : 'after'
    }
  }

  const targetSide = getSide(tree, targetNodeId) ?? defaultSide
  const towardRoot =
    (placement === 'left' && targetSide === 'right') || (placement === 'right' && targetSide === 'left')

  if (towardRoot) {
    return {
      mode: 'towardRoot',
      nodeId: targetNodeId
    }
  }

  return {
    mode: 'child',
    parentId: targetNodeId
  }
}

export const getMindmapTree = getMindmapTreeFromNode

export const getMindmapLabel = (node: MindmapNode | undefined) => {
  if (!node?.data || typeof node.data !== 'object' || !('kind' in node.data)) return 'mindmap'
  const data = node.data as { kind: string; text?: string; name?: string; title?: string; url?: string }
  switch (data.kind) {
    case 'text':
      return data.text?.trim() ? data.text : 'Text'
    case 'file':
      return data.name?.trim() ? data.name : 'File'
    case 'link':
      return data.title?.trim() ? data.title : data.url ?? 'Link'
    case 'ref':
      return data.title?.trim() ? data.title : 'Ref'
    default:
      return data.kind ?? 'mindmap'
  }
}

export const computeMindmapLayout = (
  tree: MindmapTree,
  nodeSize: Size,
  layout: MindmapLayoutConfigLike
): MindmapLayout => {
  const mode = layout.mode === 'tidy' ? 'tidy' : 'simple'
  const getNodeSize = () => nodeSize
  const layoutFn = mode === 'tidy' ? layoutMindmapTidy : layoutMindmap
  return layoutFn(tree, getNodeSize, layout.options)
}

const resolveAnchorWorld = ({
  tree,
  hint,
  nodePosition
}: {
  tree: MindmapTree
  hint: MindmapLayoutHint
  nodePosition: Node['position']
}) => {
  if (!hint.nodeSize) return undefined
  const layout = computeMindmapLayout(tree, hint.nodeSize, {
    mode: hint.mode,
    options: hint.options
  })
  const anchorId = hint.anchorId ?? tree.rootId
  const rect = layout.node[anchorId]
  if (!rect) return undefined
  const shiftX = -layout.bbox.x
  const shiftY = -layout.bbox.y
  return {
    x: nodePosition.x + rect.x + shiftX + rect.width / 2,
    y: nodePosition.y + rect.y + shiftY + rect.height / 2
  }
}

export const resolveAnchorPatch = ({
  beforeTree,
  afterTree,
  hint,
  nodePosition,
  threshold = 0.5
}: {
  beforeTree: MindmapTree
  afterTree: MindmapTree
  hint?: MindmapLayoutHint
  nodePosition: Node['position']
  threshold?: number
}): { position: Node['position'] } | undefined => {
  if (!hint?.nodeSize || !hint.anchorId) return undefined
  const before = resolveAnchorWorld({ tree: beforeTree, hint, nodePosition })
  const after = resolveAnchorWorld({ tree: afterTree, hint, nodePosition })
  if (!before || !after) return undefined
  const dx = before.x - after.x
  const dy = before.y - after.y
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return undefined
  return {
    position: {
      x: nodePosition.x + dx,
      y: nodePosition.y + dy
    }
  }
}

export const createSetOp = ({
  id,
  tree
}: {
  id: MindmapId
  tree: MindmapTree
}): Operation => ({
  type: 'mindmap.set',
  id,
  tree: cloneValue(tree)
})

export const createDeleteOps = (ids: readonly MindmapId[]): Operation[] =>
  ids.map((id) => ({
    type: 'mindmap.delete',
    id
  }))

export const createSetOps = ({
  id,
  beforeTree,
  afterTree,
  hint,
  node
}: {
  id: MindmapId
  beforeTree: MindmapTree
  afterTree: MindmapTree
  hint?: MindmapLayoutHint
  node?: Node
}): Operation[] => {
  const operations: Operation[] = [createSetOp({ id, tree: afterTree })]

  if (!node) return operations
  const anchorPatch = resolveAnchorPatch({
    beforeTree,
    afterTree,
    hint,
    nodePosition: node.position
  })
  if (!anchorPatch) return operations

  return [
    ...operations,
    {
      type: 'node.update',
      id: node.id,
      patch: anchorPatch
    }
  ]
}

export const buildMindmapLines = (
  tree: MindmapTree,
  computed: MindmapLayout
): MindmapViewLine[] => {
  const result: MindmapViewLine[] = []
  Object.entries(tree.children).forEach(([parentId, childIds]) => {
    const parent = computed.node[parentId]
    if (!parent) return
    childIds.forEach((childId) => {
      const child = computed.node[childId]
      if (!child) return
      const side = parentId === tree.rootId ? tree.nodes[childId]?.side : undefined
      const line = computeConnectionLine(parent, child, side)
      result.push({
        id: `${parentId}-${childId}`,
        x1: line.x1,
        y1: line.y1,
        x2: line.x2,
        y2: line.y2
      })
    })
  })
  return result
}
