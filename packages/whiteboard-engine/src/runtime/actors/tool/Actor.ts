import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { State } from '@engine-types/instance/state'
import { StateWatchEmitter } from '../shared/StateWatchEmitter'

type ActorOptions = {
  state: State
  emit: InstanceEventEmitter['emit']
}

export class Actor {
  readonly name = 'Tool'

  private readonly emitter: StateWatchEmitter<'select' | 'edge'>

  constructor({ state, emit }: ActorOptions) {
    this.emitter = new StateWatchEmitter({
      state,
      keys: ['tool'],
      read: () => state.read('tool'),
      equals: (left, right) => left === right,
      emit: (tool) => emit('tool.changed', { tool })
    })
  }

  start = () => {
    this.emitter.start()
  }

  stop = () => {
    this.emitter.stop()
  }
}
