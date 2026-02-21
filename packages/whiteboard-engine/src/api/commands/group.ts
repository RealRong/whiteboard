import type { Commands } from '@engine-types/commands'
import type { Actor as NodeActor } from '../../runtime/actors/node/Actor'

export const createGroup = (
  node: NodeActor
): Commands['group'] => {
  return {
    create: node.createGroup,
    ungroup: node.ungroup
  }
}
