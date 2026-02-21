import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { State } from '@engine-types/instance/state'

type ActorOptions = {
  state: State
  emit: InstanceEventEmitter['emit']
}

export class Actor {
  readonly name = 'Tool'

  private readonly state: State
  private readonly emit: InstanceEventEmitter['emit']
  private started = false
  private unsubs: Array<() => void> = []

  private lastTool: 'select' | 'edge' = 'select'
  private hasSnapshot = false

  constructor({ state, emit }: ActorOptions) {
    this.state = state
    this.emit = emit
  }

  private emitChanged = (force = false) => {
    const tool = this.state.read('tool')
    const changed = !this.hasSnapshot || this.lastTool !== tool

    if (changed) {
      this.lastTool = tool
      this.hasSnapshot = true
    }

    if (!force && !changed) return
    this.emit('tool.changed', { tool })
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.unsubs = [
      this.state.watch('tool', () => this.emitChanged(false))
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
