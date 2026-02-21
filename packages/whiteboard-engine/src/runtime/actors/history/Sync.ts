import type { Core, CoreHistoryState, DocumentId } from '@whiteboard/core'
import type { LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { StateSnapshot } from '@engine-types/instance/state'
import type { LifecycleRuntimeContext } from '../../common/contracts'

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

type HistoryContext = Pick<LifecycleRuntimeContext, 'runtime' | 'state'>

export class Sync {
  private context: HistoryContext
  private offHistory: (() => void) | null = null
  private prevIdentity: HistoryIdentity | null = null

  constructor(context: HistoryContext) {
    this.context = context
  }

  start = () => {
    if (this.offHistory) return
    const core = this.context.runtime.core
    const sync = (snapshot: CoreHistoryState) => {
      this.context.state.write('history', toHistoryState(snapshot))
    }
    sync(core.history.getState())
    this.offHistory = core.history.subscribe(sync)
  }

  update = (config: LifecycleConfig) => {
    const history = this.context.runtime.core.history

    if (config.history) {
      history.configure(config.history)
    }

    if (!config.docId) {
      this.prevIdentity = null
      return
    }

    const nextIdentity: HistoryIdentity = {
      core: this.context.runtime.core,
      docId: config.docId
    }
    const previous = this.prevIdentity
    this.prevIdentity = nextIdentity

    if (!shouldClearHistory(previous, nextIdentity)) return
    history.clear()
  }

  stop = () => {
    this.offHistory?.()
    this.offHistory = null
    this.prevIdentity = null
  }
}
