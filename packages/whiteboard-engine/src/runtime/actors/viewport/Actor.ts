import { isSameViewport } from '@whiteboard/core/geometry'
import type { Viewport } from '@whiteboard/core/types'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { State } from '@engine-types/instance/state'
import { StateWatchEmitter } from '../shared/StateWatchEmitter'

type ActorOptions = {
  state: State
  emit: InstanceEventEmitter['emit']
}

const cloneViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

export class Actor {
  readonly name = 'Viewport'

  private readonly emitter: StateWatchEmitter<Viewport>

  constructor({ state, emit }: ActorOptions) {
    this.emitter = new StateWatchEmitter({
      state,
      keys: ['viewport'],
      read: () => state.read('viewport'),
      equals: isSameViewport,
      clone: cloneViewport,
      emit: (viewport) => {
        emit('viewport.changed', { viewport: cloneViewport(viewport) })
      }
    })
  }

  start = () => {
    this.emitter.start()
  }

  stop = () => {
    this.emitter.stop()
  }
}
