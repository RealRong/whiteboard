import type { NodeWriteOutput, WriteCommandMap } from '@engine-types/command'
import type { WriteTranslateContext } from './index'
import type { TranslateResult } from './result'
import { cancelled, invalid, fromOp, fromOps, success } from './result'
import {
  buildNodeAlignOperations,
  buildNodeCreateOperation,
  buildNodeDistributeOperations,
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
  isNodeEdgeEnd,
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
  sendOrderBackward
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
type AlignCommand = Extract<NodeCommand, { type: 'align' }>
type DistributeCommand = Extract<NodeCommand, { type: 'distribute' }>

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

export const translateNode = <C extends NodeCommand>(
  command: C,
  ctx: WriteTranslateContext
): TranslateResult<NodeWriteOutput<C>> => {
  const doc = ctx.doc

  const create = (command: CreateCommand): TranslateResult<{ nodeId: NodeId }> =>
    fromOp(
      buildNodeCreateOperation({
        payload: command.payload,
        doc,
        registries: ctx.registries,
        createNodeId: ctx.ids.node
      }),
      ({ nodeId }) => ({ nodeId })
    )

  const group = (command: GroupCommand): TranslateResult<{ groupId: NodeId }> => {
    if (command.ids.length < 2) {
      return cancelled('At least two nodes are required.')
    }

    return fromOps(
      buildNodeGroupOperations({
        ids: command.ids,
        doc,
        nodeSize: ctx.config.nodeSize,
        createGroupId: ctx.ids.group
      }),
      ({ groupId }) => ({ groupId })
    )
  }

  const ungroup = (command: UngroupCommand): TranslateResult<{ nodeIds: NodeId[] }> =>
    fromOps(
      buildNodeUngroupOperations(command.id, doc),
      ({ nodeIds }) => ({ nodeIds })
    )

  const ungroupMany = (command: UngroupManyCommand): TranslateResult<{ nodeIds: NodeId[] }> => {
    if (!command.ids.length) {
      return cancelled('No groups selected.')
    }

    return fromOps(
      buildNodeUngroupManyOperations(command.ids, doc),
      ({ nodeIds }) => ({ nodeIds })
    )
  }

  const updateMany = (command: UpdateManyCommand): TranslateResult => {
    const operations = toUpdateOperations(command.updates)
    if (!operations.length) {
      return cancelled('No node updates provided.')
    }
    return success(operations)
  }

  const align = (command: AlignCommand): TranslateResult => {
    if (command.ids.length < 2) {
      return cancelled('At least two nodes are required.')
    }

    const result = buildNodeAlignOperations({
      ids: command.ids,
      doc,
      nodeSize: ctx.config.nodeSize,
      mode: command.mode
    })
    if (!result.ok) {
      return fromOps(result)
    }
    if (!result.data.operations.length) {
      return cancelled('Nodes are already aligned.')
    }
    return fromOps(result)
  }

  const distribute = (command: DistributeCommand): TranslateResult => {
    if (command.ids.length < 3) {
      return cancelled('At least three nodes are required.')
    }

    const result = buildNodeDistributeOperations({
      ids: command.ids,
      doc,
      nodeSize: ctx.config.nodeSize,
      mode: command.mode
    })
    if (!result.ok) {
      return fromOps(result)
    }
    if (!result.data.operations.length) {
      return cancelled('Nodes are already distributed.')
    }
    return fromOps(result)
  }

  const updateData = (command: DataCommand): TranslateResult => {
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

  const order = (command: OrderCommand): TranslateResult => {
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

  const deleteCascade = (command: DeleteCascadeCommand): TranslateResult => {
    if (!command.ids.length) {
      return cancelled('No nodes selected.')
    }

    const { expandedIds } = expandNodeSelection(listNodes(doc), command.ids)
    if (!expandedIds.size) {
      return cancelled('No nodes selected.')
    }

    const nodeIds = Array.from(expandedIds)
    const edgeIds = listEdges(doc)
      .filter(
        (edge) =>
          (isNodeEdgeEnd(edge.source) && expandedIds.has(edge.source.nodeId))
          || (isNodeEdgeEnd(edge.target) && expandedIds.has(edge.target.nodeId))
      )
      .map((edge) => edge.id)

    return success([
      ...edgeIds.map((id) => ({ type: 'edge.delete' as const, id })),
      ...nodeIds.map((id) => ({ type: 'node.delete' as const, id }))
    ])
  }

  const duplicate = (
    command: DuplicateCommand
  ): TranslateResult<{ nodeIds: NodeId[]; edgeIds: EdgeId[] }> =>
    fromOps(
      buildNodeDuplicateOperations({
        doc,
        ids: command.ids,
        registries: ctx.registries,
        createNodeId: ctx.ids.node,
        createEdgeId: ctx.ids.edge,
        nodeSize: ctx.config.nodeSize,
        offset: DEFAULT_TUNING.shortcuts.duplicateOffset
      }),
      ({ nodeIds, edgeIds }) => ({ nodeIds, edgeIds })
    )

  switch (command.type) {
    case 'create':
      return create(command) as TranslateResult<NodeWriteOutput<C>>
    case 'updateMany':
      return updateMany(command) as TranslateResult<NodeWriteOutput<C>>
    case 'align':
      return align(command) as TranslateResult<NodeWriteOutput<C>>
    case 'distribute':
      return distribute(command) as TranslateResult<NodeWriteOutput<C>>
    case 'data':
      return updateData(command) as TranslateResult<NodeWriteOutput<C>>
    case 'delete':
      return success(command.ids.map((id) => ({ type: 'node.delete' as const, id }))) as TranslateResult<NodeWriteOutput<C>>
    case 'deleteCascade':
      return deleteCascade(command) as TranslateResult<NodeWriteOutput<C>>
    case 'duplicate':
      return duplicate(command) as TranslateResult<NodeWriteOutput<C>>
    case 'group.create':
      return group(command) as TranslateResult<NodeWriteOutput<C>>
    case 'group.ungroup':
      return ungroup(command) as TranslateResult<NodeWriteOutput<C>>
    case 'group.ungroupMany':
      return ungroupMany(command) as TranslateResult<NodeWriteOutput<C>>
    case 'order':
      return order(command) as TranslateResult<NodeWriteOutput<C>>
    default:
      return invalid('Unsupported node action.') as TranslateResult<NodeWriteOutput<C>>
  }
}
