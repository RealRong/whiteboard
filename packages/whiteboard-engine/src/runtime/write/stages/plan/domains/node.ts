import type { InternalInstance } from '@engine-types/instance/engine'
import type {
  WriteCommandMap
} from '@engine-types/command/api'
import type { Draft } from '../draft'
import { cancelled, invalid, ops, success } from '../draft'
import type {
  Document,
  Operation
} from '@whiteboard/core/types'
import { createId } from '@whiteboard/core/utils'
import { corePlan } from '@whiteboard/core/kernel'
import { expandNodeSelection } from '@whiteboard/core/node'
import { toUpdateOperations } from '../shared/update'
import { buildDuplicateNodesDraft } from '../shared/duplicate'
import { DEFAULT_TUNING } from '../../../../../config'

type CreateCommand = Extract<NodeCommand, { type: 'create' }>
type GroupCommand = Extract<NodeCommand, { type: 'group.create' }>
type UngroupCommand = Extract<NodeCommand, { type: 'group.ungroup' }>
type UngroupManyCommand = Extract<NodeCommand, { type: 'group.ungroupMany' }>
type UpdateManyCommand = Extract<NodeCommand, { type: 'updateMany' }>
type DeleteCascadeCommand = Extract<NodeCommand, { type: 'deleteCascade' }>
type DuplicateCommand = Extract<NodeCommand, { type: 'duplicate' }>
type NodeCommand = WriteCommandMap['node']

const toInvalidMessage = (message?: string) =>
  message ?? 'Invalid node action.'

export const node = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document' | 'config' | 'registries'>
}) => {
  const readDoc = (): Document => instance.document.get()
  const createGroupId = () => createId('group')
  const createNodeId = () => createId('node')
  const createEdgeId = () => createId('edge')

  const create = (command: CreateCommand): Draft => {
    const result = corePlan.node.create({
      payload: command.payload,
      doc: readDoc(),
      registries: instance.registries,
      createNodeId
    })
    return ops(result)
  }

  const group = (command: GroupCommand): Draft => {
    if (command.ids.length < 2) {
      return cancelled('At least two nodes are required.')
    }

    const planned = corePlan.node.group({
      ids: command.ids,
      doc: readDoc(),
      nodeSize: instance.config.nodeSize,
      createGroupId
    })
    if (!planned.ok) return invalid(toInvalidMessage(planned.message))

    const groupOperation = planned.operations.find(
      (operation): operation is Extract<Operation, { type: 'node.create' }> =>
        operation.type === 'node.create' && operation.node.type === 'group'
    )
    if (!groupOperation) {
      return invalid('Missing group creation operation.')
    }

    return success(planned.operations, {
      selectedNodeIds: [groupOperation.node.id]
    })
  }

  const ungroup = (command: UngroupCommand): Draft => {
    const result = corePlan.node.ungroup({
      id: command.id,
      doc: readDoc()
    })
    return ops(result)
  }

  const ungroupMany = (command: UngroupManyCommand): Draft => {
    if (!command.ids.length) {
      return cancelled('No groups selected.')
    }

    const doc = readDoc()
    const selectedSet = new Set(command.ids)
    const groups = doc.nodes.filter(
      (node) => node.type === 'group' && selectedSet.has(node.id)
    )
    if (!groups.length) {
      return cancelled('No groups selected.')
    }

    const operations: Operation[] = []
    for (const groupNode of groups) {
      const planned = corePlan.node.ungroup({
        id: groupNode.id,
        doc
      })
      if (!planned.ok) return invalid(toInvalidMessage(planned.message))
      operations.push(...planned.operations)
    }

    return success(operations, {
      selectedNodeIds: []
    })
  }

  const updateMany = (command: UpdateManyCommand): Draft =>
    success(toUpdateOperations('node.update', command.updates))

  const deleteCascade = (command: DeleteCascadeCommand): Draft => {
    if (!command.ids.length) {
      return cancelled('No nodes selected.')
    }

    const doc = readDoc()
    const { expandedIds } = expandNodeSelection(doc.nodes, command.ids)
    if (!expandedIds.size) {
      return cancelled('No nodes selected.')
    }

    const nodeIds = Array.from(expandedIds)
    const edgeIds = doc.edges
      .filter(
        (edge) =>
          expandedIds.has(edge.source.nodeId)
          || expandedIds.has(edge.target.nodeId)
      )
      .map((edge) => edge.id)

    const operations: Operation[] = [
      ...edgeIds.map((id) => ({
        type: 'edge.delete' as const,
        id
      })),
      ...nodeIds.map((id) => ({
        type: 'node.delete' as const,
        id
      }))
    ]

    return success(operations, {
      selectedNodeIds: []
    })
  }

  const duplicate = (command: DuplicateCommand): Draft => {
    return buildDuplicateNodesDraft({
      doc: readDoc(),
      ids: command.ids,
      registries: instance.registries,
      createNodeId,
      createEdgeId,
      offset: DEFAULT_TUNING.shortcuts.duplicateOffset
    })
  }

  return (command: NodeCommand): Draft => {
    switch (command.type) {
      case 'create':
        return create(command)
      case 'updateMany':
        return updateMany(command)
      case 'delete':
        return success(command.ids.map((id) => ({ type: 'node.delete' as const, id })))
      case 'deleteCascade':
        return deleteCascade(command)
      case 'duplicate':
        return duplicate(command)
      case 'group.create':
        return group(command)
      case 'group.ungroup':
        return ungroup(command)
      case 'group.ungroupMany':
        return ungroupMany(command)
      case 'order.set':
        return success([{ type: 'node.order.set', ids: command.ids }])
      default:
        return invalid('Unsupported node action.')
    }
  }
}
