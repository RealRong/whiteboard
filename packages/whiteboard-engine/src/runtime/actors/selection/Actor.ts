import type { EdgeId, NodeId } from '@whiteboard/core'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { State } from '@engine-types/instance/state'

type ActorOptions = {
  state: State
  emit: InstanceEventEmitter['emit']
}

type EdgeSelectionValue = EdgeId | undefined

const isSameNodeIds = (left: NodeId[], right: NodeId[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export class Actor {
  readonly name = 'Selection'

  private readonly state: State
  private readonly emit: InstanceEventEmitter['emit']
  private started = false
  private unsubs: Array<() => void> = []

  private lastSelectionIds: NodeId[] = []
  private hasSelectionSnapshot = false
  private lastEdgeSelection: EdgeSelectionValue | undefined
  private hasEdgeSelectionSnapshot = false

  constructor({ state, emit }: ActorOptions) {
    this.state = state
    this.emit = emit
  }

  private emitSelectionChanged = (force = false) => {
    const ids = Array.from(this.state.read('selection').selectedNodeIds)
    const changed = !this.hasSelectionSnapshot || !isSameNodeIds(this.lastSelectionIds, ids)

    if (changed) {
      this.lastSelectionIds = ids
      this.hasSelectionSnapshot = true
    }

    if (!force && !changed) return
    this.emit('selection.changed', { nodeIds: ids })
  }

  private emitEdgeSelectionChanged = (force = false) => {
    const edgeId = this.state.read('edgeSelection')
    const changed = !this.hasEdgeSelectionSnapshot || this.lastEdgeSelection !== edgeId

    if (changed) {
      this.lastEdgeSelection = edgeId
      this.hasEdgeSelectionSnapshot = true
    }

    if (!force && !changed) return
    this.emit('edge.selection.changed', { edgeId })
  }

  private emitCurrent = () => {
    this.emitSelectionChanged(true)
    this.emitEdgeSelectionChanged(true)
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.unsubs = [
      this.state.watch('selection', () => this.emitSelectionChanged(false)),
      this.state.watch('edgeSelection', () => this.emitEdgeSelectionChanged(false))
    ]
    this.emitCurrent()
  }

  stop = () => {
    if (!this.started && !this.unsubs.length) return
    this.started = false
    this.unsubs.forEach((off) => off())
    this.unsubs = []
  }
}
