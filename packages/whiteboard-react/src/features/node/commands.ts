import type { Node, NodeId } from '@whiteboard/core/types'
import type { BoardInstance } from '../../runtime/instance'
import {
  created,
  createdGroup,
  set,
  ungroupChildren
} from '../../runtime/selection'
import type { NodeSummary } from './summary'

type NodeCommandsInstance = Pick<BoardInstance, 'commands'>
type NodeStateInstance = Pick<BoardInstance, 'commands' | 'state'>
type NodeReadInstance = Pick<BoardInstance, 'commands' | 'read'>
type NodeSelectionInstance = Pick<BoardInstance, 'commands' | 'state' | 'read'>

export type ArrangeMode = 'front' | 'forward' | 'backward' | 'back'
export type GroupAutoFitMode = 'expand-only' | 'manual'

const getSelectedNodeIds = (instance: NodeStateInstance): NodeId[] =>
  [...instance.state.selection.get().target.nodeIds]

export const deleteNodes = async (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  await instance.commands.node.deleteCascade([...nodeIds])
}

export const duplicateNodes = async (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  const result = await instance.commands.node.duplicate([...nodeIds])
  const nextNodeIds = created(result)
  if (nextNodeIds.length > 0) {
    set(instance, nextNodeIds)
  }
}

export const setNodesLocked = async (
  instance: NodeCommandsInstance,
  nodes: readonly Node[],
  locked: boolean
) => {
  if (!nodes.length) return
  const result = await instance.commands.node.updateMany(nodes.map((node) => ({
    id: node.id,
    patch: { locked }
  })))
  if (!result.ok) return
}

export const groupNodes = async (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (nodeIds.length < 2) return
  const result = await instance.commands.node.group.create([...nodeIds])
  const groupId = createdGroup(result)
  if (groupId) {
    set(instance, [groupId])
  }
}

export const groupSelection = async (
  instance: NodeStateInstance
) => {
  const nodeIds = getSelectedNodeIds(instance)
  if (nodeIds.length < 2) return
  await groupNodes(instance, nodeIds)
}

export const ungroupNodes = async (
  instance: NodeReadInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  const nextSelectedNodeIds = ungroupChildren(instance, nodeIds)
  const result = await instance.commands.node.group.ungroupMany([...nodeIds])
  if (!result.ok) return
  set(instance, nextSelectedNodeIds)
}

export const ungroupSelection = async (
  instance: NodeSelectionInstance
) => {
  const nodeIds = getSelectedNodeIds(instance)
  if (!nodeIds.length) return
  await ungroupNodes(instance, nodeIds)
}

export const arrangeNodes = async (
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

  const result = await effect
  if (!result.ok) return
}

export const updateGroupNode = async (
  instance: NodeCommandsInstance,
  nodeId: NodeId,
  patch: {
    collapsed?: boolean
    autoFit?: GroupAutoFitMode
  }
) => {
  const result = await instance.commands.node.updateData(nodeId, patch)
  if (!result.ok) return
}

export const toggleNodesLock = async (
  instance: NodeCommandsInstance,
  nodes: readonly Node[],
  summary: NodeSummary
) => {
  await setNodesLocked(instance, nodes, summary.lock !== 'all')
}
