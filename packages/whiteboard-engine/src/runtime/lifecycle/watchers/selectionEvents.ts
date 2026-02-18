import type { EdgeId, NodeId } from '@whiteboard/core'
import type { Instance } from '@engine-types/instance/instance'
import type { InstanceEventEmitter } from '@engine-types/instance/events'

type Options = {
  state: Instance['state']
  emit: InstanceEventEmitter['emit']
}

type EdgeSelectionValue = EdgeId | undefined

export type SelectionEventsWatcher = {
  start: () => void
  stop: () => void
}

const isSameNodeIds = (left: NodeId[], right: NodeId[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const createSelectionEvents = ({
  state,
  emit
}: Options): SelectionEventsWatcher => {
  let started = false
  let offSelectionWatch: (() => void) | null = null
  let offEdgeSelectionWatch: (() => void) | null = null

  let lastSelectionIds: NodeId[] = []
  let hasSelectionSnapshot = false
  let lastEdgeSelection: EdgeSelectionValue | undefined
  let hasEdgeSelectionSnapshot = false

  const emitSelectionChange = (force = false) => {
    const ids = Array.from(state.read('selection').selectedNodeIds)
    const changed = !hasSelectionSnapshot || !isSameNodeIds(lastSelectionIds, ids)

    if (changed) {
      lastSelectionIds = ids
      hasSelectionSnapshot = true
    }

    if (!force && !changed) return
    emit('selection.changed', { nodeIds: ids })
  }

  const emitEdgeSelectionChange = (force = false) => {
    const edgeId = state.read('edgeSelection')
    const changed = !hasEdgeSelectionSnapshot || lastEdgeSelection !== edgeId

    if (changed) {
      lastEdgeSelection = edgeId
      hasEdgeSelectionSnapshot = true
    }

    if (!force && !changed) return
    emit('edge.selection.changed', { edgeId })
  }

  const emitCurrent = () => {
    if (!started) return
    emitSelectionChange(true)
    emitEdgeSelectionChange(true)
  }

  const start = () => {
    if (started) return
    started = true

    if (!offSelectionWatch) {
      offSelectionWatch = state.watch('selection', () => emitSelectionChange(false))
    }
    if (!offEdgeSelectionWatch) {
      offEdgeSelectionWatch = state.watch('edgeSelection', () => emitEdgeSelectionChange(false))
    }

    emitCurrent()
  }

  const stop = () => {
    started = false
    offSelectionWatch?.()
    offSelectionWatch = null
    offEdgeSelectionWatch?.()
    offEdgeSelectionWatch = null
  }

  return {
    start,
    stop
  }
}
