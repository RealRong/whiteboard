import type { InteractionState } from '@engine-types/state'
import type { State } from '@engine-types/instance/state'

type ActorOptions = {
  state: Pick<State, 'write'>
}

const mergeInteraction = (
  prev: InteractionState,
  patch: Partial<InteractionState>
): InteractionState => ({
  ...prev,
  ...patch,
  focus: patch.focus ? { ...prev.focus, ...patch.focus } : prev.focus,
  pointer: patch.pointer
    ? {
        ...prev.pointer,
        ...patch.pointer,
        modifiers: patch.pointer.modifiers
          ? { ...prev.pointer.modifiers, ...patch.pointer.modifiers }
          : prev.pointer.modifiers
      }
    : prev.pointer,
  hover: patch.hover ? { ...prev.hover, ...patch.hover } : prev.hover
})

export class Actor {
  readonly name = 'Interaction'

  private readonly state: Pick<State, 'write'>

  constructor({ state }: ActorOptions) {
    this.state = state
  }

  update = (patch: Partial<InteractionState>) => {
    this.state.write('interaction', (prev) => mergeInteraction(prev, patch))
  }

  clearHover = () => {
    this.state.write('interaction', (prev) =>
      mergeInteraction(prev, {
        hover: {
          nodeId: undefined,
          edgeId: undefined
        }
      })
    )
  }
}
