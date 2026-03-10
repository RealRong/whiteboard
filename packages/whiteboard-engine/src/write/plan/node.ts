import type { WriteInstance } from '@engine-types/write'
import type { WriteCommandMap } from '@engine-types/command'
import type { Draft } from '../draft'
import { cancelled, invalid, op, ops, success } from '../draft'
import {
  buildNodeCreateOperation,
  buildNodeDuplicateOperations,
  buildNodeGroupOperations,
  buildNodeUngroupOperations,
  expandNodeSelection
} from '@whiteboard/core/node'
import {
  listEdges,
  listNodes,
  getNode,
  type Document,
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

const toInvalidMessage = (message?: string) =>
  message ?? 'Invalid node action.'

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

  const create = (command: CreateCommand): Draft =>
    op(
      buildNodeCreateOperation({
        payload: command.payload,
        doc: readDoc(),
        registries: instance.registries,
        createNodeId
      })
    )

  const group = (command: GroupCommand): Draft => {
    if (command.ids.length < 2) {
      return cancelled('At least two nodes are required.')
    }

    return ops(
      buildNodeGroupOperations({
        ids: command.ids,
        doc: readDoc(),
        nodeSize: instance.config.nodeSize,
        createGroupId
      })
    )
  }

  const ungroup = (command: UngroupCommand): Draft =>
    ops(buildNodeUngroupOperations(command.id, readDoc()))

  const ungroupMany = (command: UngroupManyCommand): Draft => {
    if (!command.ids.length) {
      return cancelled('No groups selected.')
    }

    const doc = readDoc()
    const selectedSet = new Set(command.ids)
    const groups = listNodes(doc).filter(
      (node) => node.type === 'group' && selectedSet.has(node.id)
    )
    if (!groups.length) {
      return cancelled('No groups selected.')
    }

    const operations: Operation[] = []
    for (const groupNode of groups) {
      const planned = buildNodeUngroupOperations(groupNode.id, doc)
      if (!planned.ok) return invalid(toInvalidMessage(planned.message))
      operations.push(...planned.operations)
    }

    return success(operations)
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

  const duplicate = (command: DuplicateCommand): Draft =>
    ops(
      buildNodeDuplicateOperations({
        doc: readDoc(),
        ids: command.ids,
        registries: instance.registries,
        createNodeId,
        createEdgeId,
        offset: DEFAULT_TUNING.shortcuts.duplicateOffset
      })
    )

  return (command: NodeCommand): Draft => {
    switch (command.type) {
      case 'create':
        return create(command)
      case 'updateMany':
        return updateMany(command)
      case 'data':
        return updateData(command)
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
      case 'order':
        return order(command)
      default:
        return invalid('Unsupported node action.')
    }
  }
}
