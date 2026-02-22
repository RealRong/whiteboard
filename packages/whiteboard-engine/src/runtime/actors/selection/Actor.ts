import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { State } from '@engine-types/instance/state'
import { StateWatchEmitter } from '../shared/StateWatchEmitter'

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

  private readonly selectionEmitter: StateWatchEmitter<NodeId[]>
  private readonly edgeSelectionEmitter: StateWatchEmitter<EdgeSelectionValue>

  constructor({ state, emit }: ActorOptions) {
    this.selectionEmitter = new StateWatchEmitter({
      state,
      keys: ['selection'],
      read: () => Array.from(state.read('selection').selectedNodeIds),
      equals: isSameNodeIds,
      clone: (value) => [...value],
      emit: (nodeIds) => emit('selection.changed', { nodeIds })
    })
    this.edgeSelectionEmitter = new StateWatchEmitter({
      state,
      keys: ['edgeSelection'],
      read: () => state.read('edgeSelection'),
      equals: (left, right) => left === right,
      emit: (edgeId) => emit('edge.selection.changed', { edgeId })
    })
  }

  start = () => {
    this.selectionEmitter.start()
    this.edgeSelectionEmitter.start()
  }

  stop = () => {
    this.selectionEmitter.stop()
    this.edgeSelectionEmitter.stop()
  }
}
