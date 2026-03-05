import type { InternalInstance } from '@engine-types/instance/engine'
import type {
  WriteCommandMap
} from '@engine-types/command/api'
import type { Draft } from '../draft'
import { cancelled, invalid, ops, success } from '../draft'
import { corePlan } from '@whiteboard/core/kernel'
import {
  getNearestEdgeSegment,
  insertRoutingPoint as insertRoutingPointPatch,
  moveRoutingPoint as moveRoutingPointPatch,
  removeRoutingPoint as removeRoutingPointPatch,
  resetRouting as resetRoutingPatch
} from '@whiteboard/core/edge'
import { createId } from '@whiteboard/core/utils'
import type {
  Edge,
  EdgeId
} from '@whiteboard/core/types'
import { toUpdateOperations } from '../shared/update'

type UpdateManyCommand = Extract<EdgeCommand, { type: 'updateMany' }>
type EdgeCommand = WriteCommandMap['edge']

export const edge = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document' | 'registries' | 'read'>
}) => {
  const createEdgeId = () => createId('edge')
  const updateMany = (command: UpdateManyCommand): Draft =>
    success(toUpdateOperations('edge.update', command.updates))

  const readEdgeById = (edgeId: EdgeId): Edge | undefined =>
    instance.document.get().edges.find((edge) => edge.id === edgeId)

  const readEdgePathEntry = (edgeId: EdgeId) =>
    instance.read.projection.edge.byId.get(edgeId)

  return (command: EdgeCommand): Draft => {
    switch (command.type) {
      case 'create': {
        const built = corePlan.edge.create({
          payload: command.payload,
          doc: instance.document.get(),
          registries: instance.registries,
          createEdgeId
        })
        return ops(built)
      }
      case 'updateMany':
        return updateMany(command)
      case 'delete':
        return success(command.ids.map((id) => ({ type: 'edge.delete' as const, id })))
      case 'order.set':
        return success([{ type: 'edge.order.set', ids: command.ids }])
      case 'routing.insertAtPoint': {
        const entry = readEdgePathEntry(command.edgeId)
        if (!entry) return cancelled('Edge not found.')
        const segmentIndex = getNearestEdgeSegment(command.pointWorld, entry.path.points)
        const patch = insertRoutingPointPatch(
          entry.edge,
          entry.path.points,
          segmentIndex,
          command.pointWorld
        )
        if (!patch) return cancelled('No routing patch generated.')
        return success([{ type: 'edge.update', id: command.edgeId, patch }])
      }
      case 'routing.move': {
        const edge = readEdgeById(command.edgeId)
        if (!edge) return cancelled('Edge not found.')
        const patch = moveRoutingPointPatch(edge, command.index, command.pointWorld)
        if (!patch) return cancelled('No routing patch generated.')
        return success([{ type: 'edge.update', id: command.edgeId, patch }])
      }
      case 'routing.remove': {
        const edge = readEdgeById(command.edgeId)
        if (!edge) return cancelled('Edge not found.')
        const patch = removeRoutingPointPatch(edge, command.index)
        if (!patch) return cancelled('No routing patch generated.')
        return success([{ type: 'edge.update', id: command.edgeId, patch }])
      }
      case 'routing.reset': {
        const edge = readEdgeById(command.edgeId)
        if (!edge) return cancelled('Edge not found.')
        return success([{
          type: 'edge.update',
          id: command.edgeId,
          patch: resetRoutingPatch(edge)
        }])
      }
      default:
        return invalid('Unsupported edge action.')
    }
  }
}
