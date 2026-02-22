import { isSameViewport } from '@whiteboard/core/geometry'
import type { Viewport } from '@whiteboard/core/types'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { State } from '@engine-types/instance/state'

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

  private readonly state: State
  private readonly emit: InstanceEventEmitter['emit']
  private started = false
  private unsubs: Array<() => void> = []

  private lastViewport: Viewport | null = null

  constructor({ state, emit }: ActorOptions) {
    this.state = state
    this.emit = emit
  }

  private emitChanged = (force = false) => {
    const viewport = this.state.read('viewport')
    const changed = !this.lastViewport || !isSameViewport(this.lastViewport, viewport)

    if (changed) {
      this.lastViewport = cloneViewport(viewport)
    }

    if (!force && !changed) return
    this.emit('viewport.changed', { viewport: cloneViewport(viewport) })
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.unsubs = [
      this.state.watch('viewport', () => this.emitChanged(false))
    ]
    this.emitChanged(true)
  }

  stop = () => {
    if (!this.started && !this.unsubs.length) return
    this.started = false
    this.unsubs.forEach((off) => off())
    this.unsubs = []
  }
}
