import type { State, StateKey } from '@engine-types/instance/state'
import { SnapshotState } from './SnapshotState'
import { WatchGroup } from './WatchGroup'

type Equals<T> = (left: T, right: T) => boolean
type Clone<T> = (value: T) => T

type Options<T> = {
  state: State
  keys: StateKey[]
  read: () => T
  equals: Equals<T>
  emit: (value: T) => void
  clone?: Clone<T>
}

export class StateWatchEmitter<T> {
  private readonly watch = new WatchGroup()
  private readonly snapshot: SnapshotState<T>
  private readonly options: Options<T>

  constructor(options: Options<T>) {
    this.options = options
    this.snapshot = new SnapshotState<T>(
      options.equals,
      options.clone
    )
  }

  private emitChanged = (force = false) => {
    const value = this.options.read()
    const changed = this.snapshot.update(value)
    if (!force && !changed) return
    this.options.emit(value)
  }

  start = () => {
    this.watch.start(
      () =>
        this.options.keys.map((key) =>
          this.options.state.watch(key, () => this.emitChanged(false))
        ),
      () => this.emitChanged(true)
    )
  }

  stop = () => {
    this.watch.stop(() => {
      this.snapshot.reset()
    })
  }
}
