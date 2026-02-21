import type { Commands } from '@engine-types/commands'
import type { Actor as EdgeActor } from '../../runtime/actors/edge/Actor'
import type { Actor as NodeActor } from '../../runtime/actors/node/Actor'

export const createOrder = (
  node: NodeActor,
  edge: EdgeActor
): Commands['order'] => {
  return {
    node: {
      set: node.setOrder,
      bringToFront: node.bringToFront,
      sendToBack: node.sendToBack,
      bringForward: node.bringForward,
      sendBackward: node.sendBackward
    },
    edge: {
      set: edge.setOrder,
      bringToFront: edge.bringToFront,
      sendToBack: edge.sendToBack,
      bringForward: edge.bringForward,
      sendBackward: edge.sendBackward
    }
  }
}
