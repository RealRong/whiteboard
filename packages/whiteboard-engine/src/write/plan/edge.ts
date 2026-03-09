import type { EngineContext } from '@engine-types/instance'
import type { WriteCommandMap } from '@engine-types/command'
import type { Draft } from '../draft'
import { cancelled, invalid, ops, success } from '../draft'
import { corePlan } from '@whiteboard/core/kernel'
import {
  getNearestEdgeSegment,
  insertRoutingPoint as insertRoutingPointPatch,
  moveRoutingPoint as moveRoutingPointPatch,
  removeRoutingPoint as removeRoutingPointPatch,
  resetRouting as resetRoutingPatch,
  resolveEdgePathFromRects
} from '@whiteboard/core/edge'
import { getNodeRect } from '@whiteboard/core/geometry'
import { createId } from '@whiteboard/core/utils'
import {
  getEdge,
  getNode,
  type Document,
  type Edge,
  type EdgeId
} from '@whiteboard/core/types'

type EdgeCommand = WriteCommandMap['edge']
type UpdateManyCommand = Extract<EdgeCommand, { type: 'updateMany' }>

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
  instance: Pick<EngineContext, 'document' | 'registries' | 'config'>
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

  return (command: EdgeCommand): Draft => {
    switch (command.type) {
      case 'create':
        return ops(
          corePlan.edge.create({
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
      case 'order.set':
        return success([{ type: 'edge.order.set', ids: command.ids }])
      case 'routing.insertAtPoint': {
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
      case 'routing.move':
        return updateRouting(command.edgeId, (edge) =>
          moveRoutingPointPatch(edge, command.index, command.pointWorld)
        )
      case 'routing.remove':
        return updateRouting(command.edgeId, (edge) =>
          removeRoutingPointPatch(edge, command.index)
        )
      case 'routing.reset':
        return updateRouting(command.edgeId, (edge) => resetRoutingPatch(edge))
      default:
        return invalid('Unsupported edge action.')
    }
  }
}
