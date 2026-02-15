import type { NodeId } from '@whiteboard/core'
import type { LifecycleConfig, Instance } from '@engine-types/instance'

type Options = {
  state: Instance['state']
}

type Callbacks = Pick<LifecycleConfig, 'onSelectionChange' | 'onEdgeSelectionChange'>
type EdgeSelectionValue = ReturnType<Instance['state']['snapshot']>['edgeSelection']

export type SelectionCallbacksBinding = {
  start: () => void
  update: (callbacks: Callbacks) => void
  stop: () => void
}

const isSameNodeIds = (left: NodeId[], right: NodeId[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const createSelectionCallbacks = ({ state }: Options): SelectionCallbacksBinding => {
  let started = false
  let callbacks: Callbacks = {
    onSelectionChange: undefined,
    onEdgeSelectionChange: undefined
  }

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
    callbacks.onSelectionChange?.(ids)
  }

  const emitEdgeSelectionChange = (force = false) => {
    const edgeId = state.read('edgeSelection')
    const changed = !hasEdgeSelectionSnapshot || lastEdgeSelection !== edgeId

    if (changed) {
      lastEdgeSelection = edgeId
      hasEdgeSelectionSnapshot = true
    }

    if (!force && !changed) return
    callbacks.onEdgeSelectionChange?.(edgeId)
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

  const update = (nextCallbacks: Callbacks) => {
    const selectionCallbackChanged = nextCallbacks.onSelectionChange !== callbacks.onSelectionChange
    const edgeSelectionCallbackChanged = nextCallbacks.onEdgeSelectionChange !== callbacks.onEdgeSelectionChange
    callbacks = nextCallbacks

    if (!started) return
    emitSelectionChange(selectionCallbackChanged)
    emitEdgeSelectionChange(edgeSelectionCallbackChanged)
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
    update,
    stop
  }
}
