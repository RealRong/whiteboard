import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { State } from '@engine-types/instance/state'
import type { HistoryState } from '@engine-types/state'

type ActorOptions = {
  state: State
  emit: InstanceEventEmitter['emit']
}

const isSameHistory = (left: HistoryState, right: HistoryState) =>
  left.canUndo === right.canUndo &&
  left.canRedo === right.canRedo &&
  left.undoDepth === right.undoDepth &&
  left.redoDepth === right.redoDepth &&
  left.isApplying === right.isApplying &&
  left.lastUpdatedAt === right.lastUpdatedAt

const cloneHistory = (history: HistoryState): HistoryState => ({
  canUndo: history.canUndo,
  canRedo: history.canRedo,
  undoDepth: history.undoDepth,
  redoDepth: history.redoDepth,
  isApplying: history.isApplying,
  lastUpdatedAt: history.lastUpdatedAt
})

export class Actor {
  readonly name = 'History'

  private readonly state: State
  private readonly emit: InstanceEventEmitter['emit']
  private started = false
  private unsubs: Array<() => void> = []

  private lastHistory: HistoryState | null = null

  constructor({ state, emit }: ActorOptions) {
    this.state = state
    this.emit = emit
  }

  private emitChanged = (force = false) => {
    const history = this.state.read('history')
    const changed = !this.lastHistory || !isSameHistory(this.lastHistory, history)

    if (changed) {
      this.lastHistory = cloneHistory(history)
    }

    if (!force && !changed) return
    this.emit('history.changed', { history: cloneHistory(history) })
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.unsubs = [
      this.state.watch('history', () => this.emitChanged(false))
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
