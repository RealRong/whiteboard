import type { Node } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance'
import { mergeRecordPatch } from '../../runtime/utils/recordPatch'

type NodeStyleWriter = Pick<WhiteboardInstance, 'commands'>

export const mergeNodeStyle = (
  current: Record<string, string | number> | undefined,
  patch: Record<string, string | number>
) => mergeRecordPatch(current, patch)

export const removeNodeStyleKey = (
  current: Record<string, string | number> | undefined,
  key: string
) => {
  if (!current || !(key in current)) {
    return current
  }

  const next = {
    ...current
  }
  delete next[key]
  return Object.keys(next).length > 0 ? next : undefined
}

export const updateNodesStyle = (
  instance: NodeStyleWriter,
  nodes: readonly Node[],
  patch: Record<string, string | number>
) => instance.commands.node.updateMany(nodes.map((node) => ({
  id: node.id,
  patch: {
    style: mergeNodeStyle(node.style, patch)
  }
})))

export const updateNodeStyle = (
  instance: NodeStyleWriter,
  node: Node,
  patch: Record<string, string | number>
) => instance.commands.node.update(node.id, {
  style: mergeNodeStyle(node.style, patch)
})

export const removeNodeStyle = (
  instance: NodeStyleWriter,
  node: Node,
  key: string
) => instance.commands.node.update(node.id, {
  style: removeNodeStyleKey(node.style, key)
})
