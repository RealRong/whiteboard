import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Node, NodeId } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance'
import type { NodeSummary } from './summary'

type NodeCommandsInstance = Pick<WhiteboardInstance, 'commands'>
type NodeStateInstance = Pick<WhiteboardInstance, 'commands' | 'state'>
type NodeReadInstance = Pick<WhiteboardInstance, 'commands' | 'read'>
type NodeSelectionInstance = Pick<WhiteboardInstance, 'commands' | 'state' | 'read'>

export type ArrangeMode = 'front' | 'forward' | 'backward' | 'back'
export type GroupAutoFitMode = 'expand-only' | 'manual'

const getSelectedNodeIds = (instance: NodeStateInstance): NodeId[] =>
  [...instance.state.selection.get().target.nodeIds]

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

export const groupNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (nodeIds.length < 2) return
  const result = instance.commands.node.group.create([...nodeIds])
  if (!result.ok) return
  instance.commands.selection.replace([result.data.groupId])
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

export const arrangeNodes = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[],
  mode: ArrangeMode
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
