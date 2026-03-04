import type { InternalInstance } from '@engine-types/instance/engine'
import type { WriteCommandMap } from '@engine-types/command/api'
import type { Draft } from '../draft'
import { cancelled, invalid, ops, success } from '../draft'
import { corePlan } from '@whiteboard/core/kernel'
import {
  insertRoutingPoint as insertRoutingPointPatch,
  moveRoutingPoint as moveRoutingPointPatch,
  removeRoutingPoint as removeRoutingPointPatch,
  resetRouting as resetRoutingPatch
} from '@whiteboard/core/edge'
import { createId } from '@whiteboard/core/utils'

type EdgeCommand = WriteCommandMap['edge']

export const edge = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document' | 'registries'>
}) => {
  const createEdgeId = () => createId('edge')

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
      case 'update':
        return success([{ type: 'edge.update', id: command.id, patch: command.patch }])
      case 'delete':
        return success(command.ids.map((id) => ({ type: 'edge.delete' as const, id })))
      case 'order.set':
        return success([{ type: 'edge.order.set', ids: command.ids }])
      case 'routing.insert': {
        const patch = insertRoutingPointPatch(
          command.edge,
          command.pathPoints,
          command.segmentIndex,
          command.pointWorld
        )
        if (!patch) return cancelled('No routing patch generated.')
        return success([{ type: 'edge.update', id: command.edge.id, patch }])
      }
      case 'routing.move': {
        const patch = moveRoutingPointPatch(command.edge, command.index, command.pointWorld)
        if (!patch) return cancelled('No routing patch generated.')
        return success([{ type: 'edge.update', id: command.edge.id, patch }])
      }
      case 'routing.remove': {
        const patch = removeRoutingPointPatch(command.edge, command.index)
        if (!patch) return cancelled('No routing patch generated.')
        return success([{ type: 'edge.update', id: command.edge.id, patch }])
      }
      case 'routing.reset':
        return success([{
          type: 'edge.update',
          id: command.edge.id,
          patch: resetRoutingPatch(command.edge)
        }])
      default:
        return invalid('Unsupported edge action.')
    }
  }
}
