import { getContainerDescendants } from '@whiteboard/core/node'
import type {
  NodeId,
  Operation
} from '@whiteboard/core/types'
import type { CommitResult } from '@whiteboard/engine'
import type { BoardInstance } from '../instance'

type CommandsInstance = Pick<BoardInstance, 'commands'>
type ReadInstance = Pick<BoardInstance, 'commands' | 'read'>

export const set = (
  instance: CommandsInstance,
  nodeIds: readonly NodeId[]
) => {
  if (nodeIds.length > 0) {
    instance.commands.selection.nodes(nodeIds, 'replace')
    return
  }

  instance.commands.selection.clear()
}

export const created = (
  result: CommitResult,
  predicate?: (operation: Extract<Operation, { type: 'node.create' }>) => boolean
): NodeId[] => {
  if (!result.ok) {
    return []
  }

  return result.changes.operations
    .filter((operation): operation is Extract<Operation, { type: 'node.create' }> =>
      operation.type === 'node.create'
    )
    .filter((operation) => predicate ? predicate(operation) : true)
    .map((operation) => operation.node.id)
}

export const createdGroup = (
  result: CommitResult
): NodeId | undefined =>
  created(result, (operation) => operation.node.type === 'group')[0]

export const ungroupChildren = (
  instance: ReadInstance,
  nodeIds: readonly NodeId[]
): NodeId[] => {
  const nodes = instance.read.index.node.all().map((entry) => entry.node)
  return nodeIds.flatMap((nodeId) =>
    getContainerDescendants(nodes, nodeId).map((node) => node.id)
  )
}
