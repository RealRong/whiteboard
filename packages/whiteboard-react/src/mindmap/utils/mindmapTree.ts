import type { MindmapTree, Node } from '@whiteboard/core'

export const getMindmapTree = (node: Node): MindmapTree | undefined => {
  const data = node.data as Record<string, unknown> | undefined
  if (!data) return
  const direct = data as unknown as MindmapTree
  if (direct && typeof direct.rootId === 'string' && typeof direct.nodes === 'object' && typeof direct.children === 'object') {
    return direct
  }
  const nested = data.mindmap as MindmapTree | undefined
  if (nested && typeof nested.rootId === 'string') return nested
  const legacy = data.tree as MindmapTree | undefined
  if (legacy && typeof legacy.rootId === 'string') return legacy
  return
}
