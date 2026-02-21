import type { Commands } from '@engine-types/commands'
import type { Actor as NodeActor } from '../../runtime/actors/node/Actor'

export const createNode = (
  node: NodeActor
): Pick<Commands, 'node'> => {
  return {
    node: {
      create: node.create,
      update: node.update,
      updateData: node.updateData,
      updateManyPosition: node.updateManyPosition,
      delete: node.delete,
    }
  }
}
