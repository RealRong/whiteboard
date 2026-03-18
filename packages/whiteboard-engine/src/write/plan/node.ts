import type { WriteInstance } from '@engine-types/write'
import type { NodeWriteOutput, WriteCommandMap } from '@engine-types/command'
import type { Draft } from '../draft'
import { cancelled, invalid, op, ops, success } from '../draft'
import {
  buildNodeCreateOperation,
  buildNodeDuplicateOperations,
  buildNodeGroupOperations,
  buildNodeUngroupManyOperations,
  buildNodeUngroupOperations,
  expandNodeSelection
} from '@whiteboard/core/node'
import {
  listEdges,
  listNodes,
  getNode,
  type Document,
  type EdgeId,
  type NodeId,
  type Operation
} from '@whiteboard/core/types'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderToBack,
  sendOrderBackward,
  createId
} from '@whiteboard/core/utils'
import { DEFAULT_TUNING } from '../../config'

type NodeCommand = WriteCommandMap['node']
type CreateCommand = Extract<NodeCommand, { type: 'create' }>
type GroupCommand = Extract<NodeCommand, { type: 'group.create' }>
type UngroupCommand = Extract<NodeCommand, { type: 'group.ungroup' }>
type UngroupManyCommand = Extract<NodeCommand, { type: 'group.ungroupMany' }>
type UpdateManyCommand = Extract<NodeCommand, { type: 'updateMany' }>
type DeleteCascadeCommand = Extract<NodeCommand, { type: 'deleteCascade' }>
type DuplicateCommand = Extract<NodeCommand, { type: 'duplicate' }>
type DataCommand = Extract<NodeCommand, { type: 'data' }>
type OrderCommand = Extract<NodeCommand, { type: 'order' }>

const toUpdateOperations = (
  updates: readonly UpdateManyCommand['updates'][number][]
) => {
  const patchById = new Map<NodeId, UpdateManyCommand['updates'][number]['patch']>()

  updates.forEach(({ id, patch }) => {
    if (!Object.keys(patch).length) return
    const previous = patchById.get(id)
    patchById.set(id, previous ? { ...previous, ...patch } : patch)
  })

  return Array.from(patchById.entries()).map(([id, patch]) => ({
    type: 'node.update' as const,
    id,
    patch
  }))
}

export const node = ({
  instance
}: {
  instance: Pick<WriteInstance, 'document' | 'config' | 'registries'>
}) => {
  const readDoc = (): Document => instance.document.get()
  const createGroupId = () => createId('group')
  const createNodeId = () => createId('node')
  const createEdgeId = () => createId('edge')

  const create = (command: CreateCommand): Draft<{ nodeId: NodeId }> =>
    op(
      buildNodeCreateOperation({
        payload: command.payload,
        doc: readDoc(),
        registries: instance.registries,
        createNodeId
      }),
      ({ nodeId }) => ({ nodeId })
    )

  const group = (command: GroupCommand): Draft<{ groupId: NodeId }> => {
    if (command.ids.length < 2) {
      return cancelled('At least two nodes are required.')
    }

    return ops(
      buildNodeGroupOperations({
        ids: command.ids,
        doc: readDoc(),
        nodeSize: instance.config.nodeSize,
        createGroupId
      }),
      ({ groupId }) => ({ groupId })
    )
  }

  const ungroup = (command: UngroupCommand): Draft<{ nodeIds: NodeId[] }> =>
    ops(
      buildNodeUngroupOperations(command.id, readDoc()),
      ({ nodeIds }) => ({ nodeIds })
    )

  const ungroupMany = (command: UngroupManyCommand): Draft<{ nodeIds: NodeId[] }> => {
    if (!command.ids.length) {
      return cancelled('No groups selected.')
    }

    return ops(
      buildNodeUngroupManyOperations(command.ids, readDoc()),
      ({ nodeIds }) => ({ nodeIds })
    )
  }

  const updateMany = (command: UpdateManyCommand): Draft =>
    success(toUpdateOperations(command.updates))

  const updateData = (command: DataCommand): Draft => {
    const doc = readDoc()
    const current = getNode(doc, command.id)
    if (!current) {
      return invalid(`Node ${command.id} not found.`)
    }
    const nextData = command.mode === 'merge'
      ? { ...(current.data ?? {}), ...command.patch }
      : { ...command.patch }
    return success([{
      type: 'node.update',
      id: command.id,
      patch: {
        data: nextData
      }
    }])
  }

  const order = (command: OrderCommand): Draft => {
    const doc = readDoc()
    const current = [...doc.nodes.order]
    const target = sanitizeOrderIds(command.ids) as NodeId[]
    let nextOrder: NodeId[]
    switch (command.mode) {
      case 'set':
        nextOrder = target
        break
      case 'front':
        nextOrder = bringOrderToFront(current, target) as NodeId[]
        break
      case 'back':
        nextOrder = sendOrderToBack(current, target) as NodeId[]
        break
      case 'forward':
        nextOrder = bringOrderForward(current, target) as NodeId[]
        break
      case 'backward':
        nextOrder = sendOrderBackward(current, target) as NodeId[]
        break
      default:
        nextOrder = target
        break
    }
    return success([{ type: 'node.order.set', ids: nextOrder }])
  }

  const deleteCascade = (command: DeleteCascadeCommand): Draft => {
    if (!command.ids.length) {
      return cancelled('No nodes selected.')
    }

    const doc = readDoc()
    const { expandedIds } = expandNodeSelection(listNodes(doc), command.ids)
    if (!expandedIds.size) {
      return cancelled('No nodes selected.')
    }

    const nodeIds = Array.from(expandedIds)
    const edgeIds = listEdges(doc)
      .filter(
        (edge) =>
          expandedIds.has(edge.source.nodeId)
          || expandedIds.has(edge.target.nodeId)
      )
      .map((edge) => edge.id)

    return success([
      ...edgeIds.map((id) => ({ type: 'edge.delete' as const, id })),
      ...nodeIds.map((id) => ({ type: 'node.delete' as const, id }))
    ])
  }

  const duplicate = (
    command: DuplicateCommand
  ): Draft<{ nodeIds: NodeId[]; edgeIds: EdgeId[] }> =>
    ops(
      buildNodeDuplicateOperations({
        doc: readDoc(),
        ids: command.ids,
        registries: instance.registries,
        createNodeId,
        createEdgeId,
        offset: DEFAULT_TUNING.shortcuts.duplicateOffset
      }),
      ({ nodeIds, edgeIds }) => ({ nodeIds, edgeIds })
    )

  return <C extends NodeCommand>(command: C): Draft<NodeWriteOutput<C>> => {
    switch (command.type) {
      case 'create':
        return create(command) as Draft<NodeWriteOutput<C>>
      case 'updateMany':
        return updateMany(command) as Draft<NodeWriteOutput<C>>
      case 'data':
        return updateData(command) as Draft<NodeWriteOutput<C>>
      case 'delete':
        return success(command.ids.map((id) => ({ type: 'node.delete' as const, id }))) as Draft<NodeWriteOutput<C>>
      case 'deleteCascade':
        return deleteCascade(command) as Draft<NodeWriteOutput<C>>
      case 'duplicate':
        return duplicate(command) as Draft<NodeWriteOutput<C>>
      case 'group.create':
        return group(command) as Draft<NodeWriteOutput<C>>
      case 'group.ungroup':
        return ungroup(command) as Draft<NodeWriteOutput<C>>
      case 'group.ungroupMany':
        return ungroupMany(command) as Draft<NodeWriteOutput<C>>
      case 'order':
        return order(command) as Draft<NodeWriteOutput<C>>
      default:
        return invalid('Unsupported node action.') as Draft<NodeWriteOutput<C>>
    }
  }
}
