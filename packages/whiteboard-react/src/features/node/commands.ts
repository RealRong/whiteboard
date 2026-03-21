import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Node, NodeId } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance'
import { mergeRecordPatch } from '../../runtime/utils/recordPatch'
import type { NodeSummary } from './summary'

type NodeCommandsInstance = Pick<WhiteboardInstance, 'commands'>
type NodeStateInstance = Pick<WhiteboardInstance, 'commands' | 'read'>
type NodeReadInstance = Pick<WhiteboardInstance, 'commands' | 'read'>
type NodeSelectionInstance = Pick<WhiteboardInstance, 'commands' | 'read'>

export type OrderMode = 'front' | 'forward' | 'backward' | 'back'
export type GroupAutoFitMode = 'expand-only' | 'manual'

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

const getSelectedNodeIds = (instance: NodeStateInstance): NodeId[] =>
  [...instance.read.selection.get().target.nodeIds]

export const deleteNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  instance.commands.node.deleteCascade([...nodeIds])
}

export const duplicateNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  const result = instance.commands.node.duplicate([...nodeIds])
  if (!result.ok) return
  if (result.data.nodeIds.length > 0) {
    instance.commands.selection.replace(result.data.nodeIds)
  }
}

export const setNodesLocked = (
  instance: NodeCommandsInstance,
  nodes: readonly Node[],
  locked: boolean
) => {
  if (!nodes.length) return
  const result = instance.commands.node.updateMany(nodes.map((node) => ({
    id: node.id,
    patch: { locked }
  })))
  if (!result.ok) return
}

export const updateNodesStyle = (
  instance: NodeCommandsInstance,
  nodes: readonly Node[],
  patch: Record<string, string | number>
) => instance.commands.node.updateMany(nodes.map((node) => ({
  id: node.id,
  patch: {
    style: mergeNodeStyle(node.style, patch)
  }
})))

export const updateNodeStyle = (
  instance: NodeCommandsInstance,
  node: Node,
  patch: Record<string, string | number>
) => instance.commands.node.update(node.id, {
  style: mergeNodeStyle(node.style, patch)
})

export const removeNodeStyle = (
  instance: NodeCommandsInstance,
  node: Node,
  key: string
) => instance.commands.node.update(node.id, {
  style: removeNodeStyleKey(node.style, key)
})

export const groupNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (nodeIds.length < 2) return
  const result = instance.commands.node.group.create([...nodeIds])
  if (!result.ok) return
  instance.commands.selection.replace([result.data.groupId])
}

export const filterNodesByType = (
  instance: NodeCommandsInstance,
  nodes: readonly Node[],
  type: string
) => {
  const nodeIds = nodes
    .filter((node) => node.type === type)
    .map((node) => node.id)

  if (!nodeIds.length) {
    return
  }

  instance.commands.selection.replace(nodeIds)
}

export const groupSelection = (
  instance: NodeStateInstance
) => {
  const nodeIds = getSelectedNodeIds(instance)
  if (nodeIds.length < 2) return
  groupNodes(instance, nodeIds)
}

export const ungroupNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  const result = instance.commands.node.group.ungroupMany([...nodeIds])
  if (!result.ok) return
  instance.commands.selection.replace(result.data.nodeIds)
}

export const ungroupSelection = (
  instance: NodeSelectionInstance
) => {
  const nodeIds = getSelectedNodeIds(instance)
  if (!nodeIds.length) return
  ungroupNodes(instance, nodeIds)
}

export const orderNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[],
  mode: OrderMode
) => {
  if (!nodeIds.length) return

  const effect =
    mode === 'front'
      ? instance.commands.node.order.bringToFront([...nodeIds])
      : mode === 'forward'
        ? instance.commands.node.order.bringForward([...nodeIds])
        : mode === 'backward'
          ? instance.commands.node.order.sendBackward([...nodeIds])
          : instance.commands.node.order.sendToBack([...nodeIds])

  const result = effect
  if (!result.ok) return
}

export const alignNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[],
  mode: NodeAlignMode
) => {
  if (nodeIds.length < 2) return
  const result = instance.commands.node.align([...nodeIds], mode)
  if (!result.ok) return
}

export const distributeNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[],
  mode: NodeDistributeMode
) => {
  if (nodeIds.length < 3) return
  const result = instance.commands.node.distribute([...nodeIds], mode)
  if (!result.ok) return
}

export const updateGroupNode = (
  instance: NodeCommandsInstance,
  nodeId: NodeId,
  patch: {
    collapsed?: boolean
    autoFit?: GroupAutoFitMode
  }
) => {
  const result = instance.commands.node.updateData(nodeId, patch)
  if (!result.ok) return
}

export const toggleNodesLock = (
  instance: NodeCommandsInstance,
  nodes: readonly Node[],
  summary: NodeSummary
) => {
  setNodesLocked(instance, nodes, summary.lock !== 'all')
}
