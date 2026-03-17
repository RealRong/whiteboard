import type {
  DispatchResult,
  Node,
  NodeId,
  Operation
} from '@whiteboard/core/types'
import type { BoardInstance } from '../../runtime/instance'
import { type NodeSummary } from '../../features/node/summary'
import {
  setNodesLocked,
  ungroupNodes
} from '../../features/node/commands'

type CommandsInstance = Pick<BoardInstance, 'commands'>
type StateInstance = Pick<BoardInstance, 'commands' | 'state'>
type ReadInstance = Pick<BoardInstance, 'commands' | 'state' | 'read'>

export type ArrangeMode = 'front' | 'forward' | 'backward' | 'back'
export type GroupAutoFitMode = 'expand-only' | 'manual'

const readCreatedNodeIds = (
  result: DispatchResult,
  predicate?: (operation: Extract<Operation, { type: 'node.create' }>) => boolean
): NodeId[] => {
  if (!result.ok) return []
  return result.changes.operations
    .filter((operation): operation is Extract<Operation, { type: 'node.create' }> =>
      operation.type === 'node.create'
    )
    .filter((operation) => predicate ? predicate(operation) : true)
    .map((operation) => operation.node.id)
}

const readCreatedGroupId = (result: DispatchResult): NodeId | undefined =>
  readCreatedNodeIds(result, (operation) => operation.node.type === 'group')[0]

const getSelectedNodeIds = (instance: StateInstance): NodeId[] =>
  [...instance.state.selection.get().target.nodeIds]

export const readLockLabel = (
  summary: NodeSummary
) => (
  summary.lock === 'all'
    ? (summary.count > 1 ? 'Unlock selected' : 'Unlock')
    : (summary.count > 1 ? 'Lock selected' : 'Lock')
)

export const groupCurrentSelection = async (
  instance: StateInstance
) => {
  const nodeIds = getSelectedNodeIds(instance)
  if (nodeIds.length < 2) return

  const result = await instance.commands.node.group.create(nodeIds)
  const groupId = readCreatedGroupId(result)
  if (!groupId) return
  instance.commands.selection.nodes([groupId], 'replace')
}

export const ungroupCurrentSelection = async (
  instance: ReadInstance
) => {
  const nodeIds = getSelectedNodeIds(instance)
  if (!nodeIds.length) return
  await ungroupNodes(instance, nodeIds)
}

export const arrangeNodes = async (
  instance: CommandsInstance,
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
  instance: CommandsInstance,
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
  instance: CommandsInstance,
  nodes: readonly Node[],
  summary: NodeSummary
) => {
  await setNodesLocked(instance, nodes, summary.lock !== 'all')
}
