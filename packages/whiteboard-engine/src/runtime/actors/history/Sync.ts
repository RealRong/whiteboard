import type { DocumentId } from '@whiteboard/core'
import type { LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { RuntimeHistory } from '@engine-types/instance/runtime'
import type { StateSnapshot } from '@engine-types/instance/state'
import type { LifecycleRuntimeContext } from '../../common/contracts'

type HistoryIdentity = {
  docId: DocumentId
}

const toHistoryState = (
  snapshot: ReturnType<RuntimeHistory['getState']>
): StateSnapshot['history'] => ({
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
    const history = this.context.runtime.history
    const sync = (snapshot: ReturnType<RuntimeHistory['getState']>) => {
      this.context.state.write('history', toHistoryState(snapshot))
    }
    sync(history.getState())
    this.offHistory = history.subscribe(sync)
  }

  update = (config: LifecycleConfig) => {
    const history = this.context.runtime.history

    if (config.history) {
      history.configure(config.history)
    }

    if (!config.docId) {
      this.prevIdentity = null
      return
    }

    const nextIdentity: HistoryIdentity = {
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
