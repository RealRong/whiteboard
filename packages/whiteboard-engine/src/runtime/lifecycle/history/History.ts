import type { CoreHistoryState } from '@whiteboard/core'
import type { Instance } from '@engine-types/instance'
import type { LifecycleConfig } from '@engine-types/instance'
import { shouldClearHistory, toHistoryState, type HistoryIdentity } from './state'

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
    sync(this.instance.runtime.core.commands.history.getState())
    this.offHistory = this.instance.runtime.core.commands.history.subscribe(sync)
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
