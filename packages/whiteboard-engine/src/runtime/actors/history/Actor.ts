import type { InternalInstance } from '@engine-types/instance/instance'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { HistoryState } from '@engine-types/state'
import { StateWatchEmitter } from '../shared/StateWatchEmitter'

type ActorOptions = {
  instance: Pick<InternalInstance, 'state' | 'commands'>
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

  private readonly instance: ActorOptions['instance']
  private readonly emitter: StateWatchEmitter<HistoryState>

  constructor({ instance, emit }: ActorOptions) {
    this.instance = instance
    const state = instance.state
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

  undo = () => this.instance.commands.history.undo()

  redo = () => this.instance.commands.history.redo()
}
