import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { State } from '@engine-types/instance/state'
import type { HistoryState } from '@engine-types/state'
import { StateWatchEmitter } from '../shared/StateWatchEmitter'

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

  private readonly emitter: StateWatchEmitter<HistoryState>

  constructor({ state, emit }: ActorOptions) {
    this.emitter = new StateWatchEmitter({
      state,
      keys: ['history'],
      read: () => state.read('history'),
      equals: isSameHistory,
      clone: cloneHistory,
      emit: (history) => {
        emit('history.changed', { history: cloneHistory(history) })
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
