import type { Commands } from '@engine-types/commands'
import type { Actor as EdgeActor } from '../../runtime/actors/edge/Actor'

export const createEdge = (
  edge: EdgeActor
): Pick<Commands, 'edge'> => {
  return {
    edge: {
      insertRoutingPoint: edge.insertRoutingPoint,
      moveRoutingPoint: edge.moveRoutingPoint,
      removeRoutingPoint: edge.removeRoutingPoint,
      resetRouting: edge.resetRouting,
      create: edge.create,
      update: edge.update,
      delete: edge.delete,
      select: edge.select
    }
  }
}
