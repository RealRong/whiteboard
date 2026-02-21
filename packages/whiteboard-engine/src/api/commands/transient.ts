import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Actor as EdgeActor } from '../../runtime/actors/edge/Actor'
import type { Actor as NodeActor } from '../../runtime/actors/node/Actor'

type CommandContext = {
  instance: InternalInstance
}

export const createTransient = ({
  instance,
  edge,
  node
}: CommandContext & {
  edge: EdgeActor
  node: NodeActor
}): Commands['transient'] => {
  const { write, batch } = instance.state

  return {
    dragGuides: {
      set: node.setDragGuides,
      clear: node.clearDragGuides
    },
    nodeOverrides: {
      set: node.setOverrides,
      clear: node.clearOverrides,
      commit: node.commitOverrides
    },
    reset: () => {
      batch(() => {
        edge.resetTransientState()
        node.resetTransientState()
        write('mindmapDrag', {})
      })
    }
  }
}
