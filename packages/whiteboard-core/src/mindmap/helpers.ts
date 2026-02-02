import type { MindmapTree } from './types'
import type { Node } from '../types/core'

const isMindmapTree = (value: unknown): value is MindmapTree => {
  if (!value || typeof value !== 'object') return false
  const tree = value as MindmapTree
  return typeof tree.rootId === 'string' && typeof tree.nodes === 'object' && typeof tree.children === 'object'
}

export const getMindmapTreeFromNode = (node: Node | undefined): MindmapTree | undefined => {
  if (!node || node.type !== 'mindmap') return
  const data = node.data as Record<string, unknown> | undefined
  if (!data) return
  const direct = data as unknown
  if (isMindmapTree(direct)) return direct
  const nested = data.mindmap
  if (isMindmapTree(nested)) return nested
  const legacy = data.tree
  if (isMindmapTree(legacy)) return legacy
  return
}

export const withMindmapTree = (node: Node, tree: MindmapTree): Node => {
  const data = node.data && typeof node.data === 'object' ? (node.data as Record<string, unknown>) : {}
  return {
    ...node,
    data: {
      ...data,
      mindmap: tree
    }
  }
}
