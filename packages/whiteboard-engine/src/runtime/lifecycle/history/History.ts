import type { Core, CoreHistoryState, DocumentId } from '@whiteboard/core'
import type { Instance } from '@engine-types/instance/instance'
import type { LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { StateSnapshot } from '@engine-types/instance/state'

type HistoryIdentity = {
  core: Core
  docId: DocumentId
}

const toHistoryState = (snapshot: CoreHistoryState): StateSnapshot['history'] => ({
  canUndo: snapshot.canUndo,
  canRedo: snapshot.canRedo,
  undoDepth: snapshot.undoDepth,
  redoDepth: snapshot.redoDepth,
  isApplying: snapshot.isApplying,
  lastUpdatedAt: snapshot.lastUpdatedAt
})

const shouldClearHistory = (
  previous: HistoryIdentity | null,
  next: HistoryIdentity
) => {
  if (!previous) return false
  if (previous.core !== next.core) return true
  return previous.docId !== next.docId
}

export class History {
  private instance: Instance
  private offHistory: (() => void) | null = null
  private prevIdentity: HistoryIdentity | null = null

  constructor(instance: Instance) {
    this.instance = instance
  }

  start = () => {
    if (this.offHistory) return
    const sync = (snapshot: CoreHistoryState) => {
      this.instance.state.write('history', toHistoryState(snapshot))
    }
    sync(this.instance.runtime.core.history.getState())
    this.offHistory = this.instance.runtime.core.history.subscribe(sync)
  }

  update = (config: LifecycleConfig) => {
    if (config.history) {
      this.instance.commands.history.configure(config.history)
    }

    if (!config.docId) {
      this.prevIdentity = null
      return
    }

    const nextIdentity: HistoryIdentity = {
      core: this.instance.runtime.core,
      docId: config.docId
    }
    const previous = this.prevIdentity
    this.prevIdentity = nextIdentity

    if (!shouldClearHistory(previous, nextIdentity)) return
    this.instance.commands.history.clear()
  }

  stop = () => {
    this.offHistory?.()
    this.offHistory = null
    this.prevIdentity = null
  }
}
