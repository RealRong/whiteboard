import type { WriteInstance } from '@engine-types/write'
import type { WriteCommandMap } from '@engine-types/command'
import type { Draft } from '../draft'
import { cancelled, invalid, op, success } from '../draft'
import {
  buildEdgeCreateOperation,
  getNearestEdgeSegment,
  insertRoutingPoint as insertRoutingPointPatch,
  moveRoutingPoint as moveRoutingPointPatch,
  removeRoutingPoint as removeRoutingPointPatch,
  resetRouting as resetRoutingPatch,
  resolveEdgePathFromRects
} from '@whiteboard/core/edge'
import { getNodeRect } from '@whiteboard/core/geometry'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack,
  createId
} from '@whiteboard/core/utils'
import {
  getEdge,
  getNode,
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

export const edge = ({
  instance
}: {
  instance: Pick<WriteInstance, 'document' | 'registries' | 'config'>
}) => {
  const readDoc = () => instance.document.get()
  const createEdgeId = () => createId('edge')

  const updateMany = (command: UpdateManyCommand): Draft =>
    success(toUpdateOperations(command.updates))

  const readEdge = (edgeId: EdgeId): Edge | undefined =>
    getEdge(readDoc(), edgeId)

  const resolvePathPoints = (
    doc: Document,
    edge: Edge
  ) => {
    const sourceNode = getNode(doc, edge.source.nodeId)
    const targetNode = getNode(doc, edge.target.nodeId)
    if (!sourceNode || !targetNode) return undefined

    return resolveEdgePathFromRects({
      edge,
      source: {
        rect: getNodeRect(sourceNode, instance.config.nodeSize),
        rotation: sourceNode.rotation
      },
      target: {
        rect: getNodeRect(targetNode, instance.config.nodeSize),
        rotation: targetNode.rotation
      }
    }).path.points
  }

  const updateRouting = (
    edgeId: EdgeId,
    buildPatch: (edge: Readonly<Edge>) => ReturnType<typeof resetRoutingPatch> | undefined
  ): Draft => {
    const edge = readEdge(edgeId)
    if (!edge) return cancelled('Edge not found.')
    const patch = buildPatch(edge)
    if (!patch) return cancelled('No routing patch generated.')
    return success([{ type: 'edge.update', id: edgeId, patch }])
  }

  const order = (command: OrderCommand): Draft => {
    const doc = readDoc()
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

  return (command: EdgeCommand): Draft => {
    switch (command.type) {
      case 'create':
        return op(
          buildEdgeCreateOperation({
            payload: command.payload,
            doc: readDoc(),
            registries: instance.registries,
            createEdgeId
          })
        )
      case 'updateMany':
        return updateMany(command)
      case 'delete':
        return success(command.ids.map((id) => ({ type: 'edge.delete' as const, id })))
      case 'order':
        return order(command)
      case 'routing': {
        switch (command.mode) {
          case 'insert': {
            if (!command.pointWorld) return invalid('Routing point required.')
            const doc = readDoc()
            const edge = getEdge(doc, command.edgeId)
            if (!edge) return cancelled('Edge not found.')
            const pathPoints = resolvePathPoints(doc, edge)
            if (!pathPoints?.length) return cancelled('Edge path unavailable.')
            const segmentIndex = getNearestEdgeSegment(command.pointWorld, pathPoints)
            const patch = insertRoutingPointPatch(
              edge,
              pathPoints,
              segmentIndex,
              command.pointWorld
            )
            if (!patch) return cancelled('No routing patch generated.')
            return success([{ type: 'edge.update', id: edge.id, patch }])
          }
          case 'move':
            if (command.index === undefined || !command.pointWorld) {
              return invalid('Routing index and point required.')
            }
            return updateRouting(command.edgeId, (edge) =>
              moveRoutingPointPatch(edge, command.index!, command.pointWorld!)
            )
          case 'remove':
            if (command.index === undefined) return invalid('Routing index required.')
            return updateRouting(command.edgeId, (edge) =>
              removeRoutingPointPatch(edge, command.index!)
            )
          case 'reset':
            return updateRouting(command.edgeId, (edge) => resetRoutingPatch(edge))
          default:
            return invalid('Unsupported routing mode.')
        }
      }
      default:
        return invalid('Unsupported edge action.')
    }
  }
}
