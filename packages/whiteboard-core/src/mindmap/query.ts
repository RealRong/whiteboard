import {
  type MindmapLayout,
  type MindmapNode,
  type MindmapNodeId,
  type MindmapTree
} from './types'
import { layoutMindmap, layoutMindmapTidy } from './layout'
import type { Node, Size } from '../types/core'

export type MindmapViewLine = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type MindmapLayoutConfigLike = {
  mode?: 'simple' | 'tidy'
  options?: {
    hGap?: number
    vGap?: number
    side?: 'left' | 'right' | 'both'
  }
}

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

const isMindmapTree = (value: unknown): value is MindmapTree => {
  if (!value || typeof value !== 'object') return false
  const tree = value as MindmapTree
  return typeof tree.rootId === 'string' && typeof tree.nodes === 'object' && typeof tree.children === 'object'
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

export const getChildrenIds = (tree: MindmapTree, nodeId: MindmapNodeId) => tree.children[nodeId] ?? []

export const getParentId = (tree: MindmapTree, nodeId: MindmapNodeId) => tree.nodes[nodeId]?.parentId

export const getSiblings = (tree: MindmapTree, nodeId: MindmapNodeId) => {
  const parentId = getParentId(tree, nodeId)
  if (!parentId) return []
  return (tree.children[parentId] ?? []).filter((id) => id !== nodeId)
}

export const getPathToRoot = (tree: MindmapTree, nodeId: MindmapNodeId) => {
  const path: MindmapNodeId[] = []
  let current: MindmapNodeId | undefined = nodeId
  const guard = new Set<MindmapNodeId>()
  while (current) {
    if (guard.has(current)) break
    guard.add(current)
    path.push(current)
    current = tree.nodes[current]?.parentId
  }
  return path
}

export const getDepth = (tree: MindmapTree, nodeId: MindmapNodeId) => {
  const path = getPathToRoot(tree, nodeId)
  return Math.max(0, path.length - 1)
}

export const isAncestor = (tree: MindmapTree, ancestorId: MindmapNodeId, nodeId: MindmapNodeId) => {
  let current = tree.nodes[nodeId]?.parentId
  while (current) {
    if (current === ancestorId) return true
    current = tree.nodes[current]?.parentId
  }
  return false
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

export const getMindmapTree = (node: Node | undefined): MindmapTree | undefined => {
  if (!node || node.type !== 'mindmap') return undefined
  const data = node.data as Record<string, unknown> | undefined
  if (!data) return undefined

  const direct = data as unknown
  if (isMindmapTree(direct)) return direct

  const nested = data.mindmap
  if (isMindmapTree(nested)) return nested

  const legacy = data.tree
  if (isMindmapTree(legacy)) return legacy
  return undefined
}

export const getMindmapRoots = (nodes: Node[]) =>
  nodes.filter((node) => node.type === 'mindmap')

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

export const toMindmapStructureSignature = (tree: MindmapTree) => {
  const nodesSignature = Object.entries(tree.nodes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, node]) => `${id}:${node.parentId ?? ''}:${node.side ?? ''}:${safeStringify(node.data)}`)
    .join(';')

  const childrenSignature = Object.entries(tree.children)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, children]) => `${id}:${children.join(',')}`)
    .join(';')

  return `${tree.rootId}|${nodesSignature}|${childrenSignature}`
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
