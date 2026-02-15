import type { CoreHistoryState } from '@whiteboard/core'
import type { WhiteboardInstance } from '@engine-types/instance'
import type { WhiteboardLifecycleConfig } from '@engine-types/instance'
import { shouldClearHistory, toHistoryState, type HistoryIdentity } from './historyLifecycle'

export class HistoryBindingController {
  private instance: WhiteboardInstance
  private offHistoryBinding: (() => void) | null = null
  private previousHistoryIdentity: HistoryIdentity | null = null

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
  }

  start = () => {
    if (this.offHistoryBinding) return
    const sync = (snapshot: CoreHistoryState) => {
      this.instance.state.write('history', toHistoryState(snapshot))
    }
    sync(this.instance.runtime.core.commands.history.getState())
    this.offHistoryBinding = this.instance.runtime.core.commands.history.subscribe(sync)
  }

  update = (config: WhiteboardLifecycleConfig) => {
    if (config.history) {
      this.instance.commands.history.configure(config.history)
    }

    if (!config.docId) {
      this.previousHistoryIdentity = null
      return
    }

    const nextIdentity: HistoryIdentity = {
      core: this.instance.runtime.core,
      docId: config.docId
    }
    const previous = this.previousHistoryIdentity
    this.previousHistoryIdentity = nextIdentity

    if (!shouldClearHistory(previous, nextIdentity)) return
    this.instance.commands.history.clear()
  }

  stop = () => {
    this.offHistoryBinding?.()
    this.offHistoryBinding = null
    this.previousHistoryIdentity = null
  }
}
