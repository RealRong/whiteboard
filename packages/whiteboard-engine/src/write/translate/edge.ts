import type { EdgeWriteOutput, WriteCommandMap } from '@engine-types/command'
import type { WriteTranslateContext } from './index'
import type { TranslateResult } from './result'
import { cancelled, invalid, fromOp, success } from './result'
import {
  buildEdgeCreateOperation,
  getNearestEdgeInsertIndex,
  insertPathPoint as insertPathPointPatch,
  moveEdge as moveEdgePatch,
  movePathPoint as movePathPointPatch,
  removePathPoint as removePathPointPatch,
  clearPath as clearPathPatch,
  resolveEdgePathFromRects
} from '@whiteboard/core/edge'
import { getNodeRect } from '@whiteboard/core/geometry'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'
import {
  getEdge,
  getNode,
  isNodeEdgeEnd,
  type Document,
  type Edge,
  type EdgeId
} from '@whiteboard/core/types'

type EdgeCommand = WriteCommandMap['edge']
type UpdateManyCommand = Extract<EdgeCommand, { type: 'updateMany' }>
type OrderCommand = Extract<EdgeCommand, { type: 'order' }>

const toUpdateOperations = (
  updates: readonly UpdateManyCommand['updates'][number][]
) => {
  const patchById = new Map<EdgeId, UpdateManyCommand['updates'][number]['patch']>()

  updates.forEach(({ id, patch }) => {
    if (!Object.keys(patch).length) return
    const previous = patchById.get(id)
    patchById.set(id, previous ? { ...previous, ...patch } : patch)
  })

  return Array.from(patchById.entries()).map(([id, patch]) => ({
    type: 'edge.update' as const,
    id,
    patch
  }))
}

const resolvePath = (
  doc: Document,
  edge: Edge,
  nodeSize: WriteTranslateContext['config']['nodeSize']
) => {
  const sourceNode =
    isNodeEdgeEnd(edge.source)
      ? getNode(doc, edge.source.nodeId)
      : undefined
  const targetNode =
    isNodeEdgeEnd(edge.target)
      ? getNode(doc, edge.target.nodeId)
      : undefined
  if (isNodeEdgeEnd(edge.source) && !sourceNode) return undefined
  if (isNodeEdgeEnd(edge.target) && !targetNode) return undefined

  return resolveEdgePathFromRects({
    edge,
    source: sourceNode
      ? {
          rect: getNodeRect(sourceNode, nodeSize),
          rotation: sourceNode.rotation
        }
      : undefined,
    target: targetNode
      ? {
          rect: getNodeRect(targetNode, nodeSize),
          rotation: targetNode.rotation
        }
      : undefined
  }).path
}

export const translateEdge = <C extends EdgeCommand>(
  command: C,
  ctx: WriteTranslateContext
): TranslateResult<EdgeWriteOutput<C>> => {
  const doc = ctx.doc

  const updateMany = (command: UpdateManyCommand): TranslateResult => {
    const operations = toUpdateOperations(command.updates)
    if (!operations.length) {
      return cancelled('No edge updates provided.')
    }
    return success(operations)
  }

  const updatePath = (
    edgeId: EdgeId,
    buildPatch: (edge: Readonly<Edge>) => ReturnType<typeof clearPathPatch> | undefined
  ): TranslateResult => {
    const edge = getEdge(doc, edgeId)
    if (!edge) return cancelled('Edge not found.')
    const patch = buildPatch(edge)
    if (!patch) return cancelled('No path patch generated.')
    return success([{ type: 'edge.update', id: edgeId, patch }])
  }

  const order = (command: OrderCommand): TranslateResult => {
    const current = [...doc.edges.order]
    const target = sanitizeOrderIds(command.ids) as EdgeId[]
    let nextOrder: EdgeId[]
    switch (command.mode) {
      case 'set':
        nextOrder = target
        break
      case 'front':
        nextOrder = bringOrderToFront(current, target) as EdgeId[]
        break
      case 'back':
        nextOrder = sendOrderToBack(current, target) as EdgeId[]
        break
      case 'forward':
        nextOrder = bringOrderForward(current, target) as EdgeId[]
        break
      case 'backward':
        nextOrder = sendOrderBackward(current, target) as EdgeId[]
        break
      default:
        nextOrder = target
        break
    }
    return success([{ type: 'edge.order.set', ids: nextOrder }])
  }

  switch (command.type) {
    case 'create':
      return fromOp(
        buildEdgeCreateOperation({
          payload: command.payload,
          doc,
          registries: ctx.registries,
          createEdgeId: ctx.ids.edge
        }),
        ({ edgeId }) => ({ edgeId })
      ) as TranslateResult<EdgeWriteOutput<C>>
    case 'move':
      return updatePath(command.edgeId, (edge) =>
        moveEdgePatch(edge, command.delta)
      ) as TranslateResult<EdgeWriteOutput<C>>
    case 'updateMany':
      return updateMany(command) as TranslateResult<EdgeWriteOutput<C>>
    case 'delete':
      return success(command.ids.map((id) => ({ type: 'edge.delete' as const, id }))) as TranslateResult<EdgeWriteOutput<C>>
    case 'order':
      return order(command) as TranslateResult<EdgeWriteOutput<C>>
    case 'path': {
      switch (command.mode) {
        case 'insert': {
          if (!command.point) return invalid('Path point required.')
          const edge = getEdge(doc, command.edgeId)
          if (!edge) return cancelled('Edge not found.')
          const path = resolvePath(doc, edge, ctx.config.nodeSize)
          if (!path || !path.points.length || !path.segments.length) {
            return cancelled('Edge path unavailable.')
          }
          const insertIndex = getNearestEdgeInsertIndex(command.point, path.segments)
          const patch = insertPathPointPatch(
            edge,
            insertIndex,
            command.point
          )
          if (!patch.ok) return invalid(patch.error.message, patch.error.details)
          return success(
            [{ type: 'edge.update', id: edge.id, patch: patch.data.patch }],
            { index: patch.data.index }
          ) as TranslateResult<EdgeWriteOutput<C>>
        }
        case 'move':
          if (command.index === undefined || !command.point) {
            return invalid('Path index and point required.')
          }
          {
            const index = command.index
            const point = command.point
            return updatePath(command.edgeId, (edge) =>
              movePathPointPatch(edge, index, point)
            ) as TranslateResult<EdgeWriteOutput<C>>
          }
        case 'remove':
          if (command.index === undefined) return invalid('Path index required.')
          {
            const index = command.index
            return updatePath(command.edgeId, (edge) =>
              removePathPointPatch(edge, index)
            ) as TranslateResult<EdgeWriteOutput<C>>
          }
        case 'clear':
          return updatePath(command.edgeId, (edge) => clearPathPatch(edge)) as TranslateResult<EdgeWriteOutput<C>>
        default:
          return invalid('Unsupported path mode.') as TranslateResult<EdgeWriteOutput<C>>
      }
    }
    default:
      return invalid('Unsupported edge action.') as TranslateResult<EdgeWriteOutput<C>>
  }
}
