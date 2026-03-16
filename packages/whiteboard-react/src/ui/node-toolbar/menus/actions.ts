import type { Node } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../../runtime/instance'
import { mergeRecordPatch } from '../../../runtime/utils/recordPatch'

type ToolbarMenuInstance = Pick<WhiteboardInstance, 'commands'>

const mergeStyle = (
  current: Record<string, string | number> | undefined,
  patch: Record<string, string | number>
) => mergeRecordPatch(current, patch)

export const mergeData = (
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
) => mergeRecordPatch(current, patch)

export const updateNodesStyle = (
  instance: ToolbarMenuInstance,
  nodes: readonly Node[],
  patch: Record<string, string | number>
) => instance.commands.node.updateMany(nodes.map((node) => ({
  id: node.id,
  patch: {
    style: mergeStyle(node.style, patch)
  }
})))

export const updateNodeStyle = (
  instance: ToolbarMenuInstance,
  node: Node,
  patch: Record<string, string | number>
) => instance.commands.node.update(node.id, {
  style: mergeStyle(node.style, patch)
})

export const runAndClose = (
  close: () => void,
  effect: Promise<unknown>
) => {
  void effect.finally(close)
}
