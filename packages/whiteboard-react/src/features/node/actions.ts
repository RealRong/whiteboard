import { getContainerDescendants } from '@whiteboard/core/node'
import type {
  DispatchResult,
  Node,
  NodeId,
  Operation
} from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance'

type NodeCommandsInstance = Pick<WhiteboardInstance, 'commands'>
type NodeReadInstance = Pick<WhiteboardInstance, 'commands' | 'read'>
type NodeStateInstance = Pick<WhiteboardInstance, 'commands' | 'state'>

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

const readCreatedGroupId = (
  result: DispatchResult
): NodeId | undefined =>
  readCreatedNodeIds(result, (operation) => operation.node.type === 'group')[0]

export const selectNodeIds = (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (nodeIds.length > 0) {
    instance.commands.selection.select(nodeIds, 'replace')
    return
  }
  instance.commands.selection.clear()
}

export const deleteNodes = async (
  instance: NodeStateInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  const selectedNodeIds = instance.state.selection.get().target.nodeIds
  const result = await instance.commands.node.deleteCascade([...nodeIds])
  if (!result.ok) return
  if (nodeIds.some((nodeId) => selectedNodeIds.includes(nodeId))) {
    instance.commands.selection.clear()
  }
}

export const duplicateNodes = async (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  const result = await instance.commands.node.duplicate([...nodeIds])
  const nextNodeIds = readCreatedNodeIds(result)
  if (!nextNodeIds.length) return
  instance.commands.selection.select(nextNodeIds, 'replace')
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
  selectNodeIds(instance, nodes.map((node) => node.id))
}

export const groupNodes = async (
  instance: NodeCommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (nodeIds.length < 2) return
  const result = await instance.commands.node.group.create([...nodeIds])
  const groupId = readCreatedGroupId(result)
  if (!groupId) return
  instance.commands.selection.select([groupId], 'replace')
}

export const ungroupNodes = async (
  instance: NodeReadInstance,
  nodeIds: readonly NodeId[]
) => {
  if (!nodeIds.length) return
  const nodes = instance.read.index.node.all().map((entry) => entry.node)
  const nextSelectedNodeIds = nodeIds.flatMap((nodeId) =>
    getContainerDescendants(nodes, nodeId).map((node) => node.id)
  )
  const result = await instance.commands.node.group.ungroupMany([...nodeIds])
  if (!result.ok) return
  selectNodeIds(instance, nextSelectedNodeIds)
}
