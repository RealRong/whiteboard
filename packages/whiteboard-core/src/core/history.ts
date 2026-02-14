import type { ChangeHandlers } from './changes'
import type { CoreState } from './state'
import type { CoreHistoryConfig, CoreHistoryState, Document, Origin } from '../types/core'

type HistoryEntry = {
  before: Document
  after: Document
  timestamp: number
  origin?: Origin
  source: 'single' | 'transaction'
}

type HistoryCollectorState = {
  isApplying: boolean
  undo: HistoryEntry[]
  redo: HistoryEntry[]
  txDepth: number
  txBefore?: Document
  txAfter?: Document
  txOrigin?: Origin
  txTimestamp?: number
}

type CreateCoreHistoryDeps = {
  state: CoreState
  changes: ChangeHandlers
  now: () => number
  applyDocumentSnapshot: (document: Document) => void
}

const DEFAULT_HISTORY_CONFIG: CoreHistoryConfig = {
  enabled: true,
  capacity: 100,
  captureSystem: true,
  captureRemote: false
}

const cloneValue = <T,>(value: T): T => {
  const structuredCloneFn = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (structuredCloneFn) {
    return structuredCloneFn(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const cloneDocument = (document: Document): Document => cloneValue(document)

const createStateSnapshot = (collector: HistoryCollectorState, now: () => number): CoreHistoryState => ({
  canUndo: collector.undo.length > 0,
  canRedo: collector.redo.length > 0,
  undoDepth: collector.undo.length,
  redoDepth: collector.redo.length,
  isApplying: collector.isApplying,
  lastUpdatedAt: now()
})

export const createCoreHistory = ({ state, changes, now, applyDocumentSnapshot }: CreateCoreHistoryDeps) => {
  const config: CoreHistoryConfig = { ...DEFAULT_HISTORY_CONFIG }
  const listeners = new Set<(snapshot: CoreHistoryState) => void>()

  const collector: HistoryCollectorState = {
    isApplying: false,
    undo: [],
    redo: [],
    txDepth: 0,
    txBefore: undefined,
    txAfter: undefined,
    txOrigin: undefined,
    txTimestamp: undefined
  }

  let lastSnapshot = cloneDocument(state.getDocument())

  const emit = () => {
    const snapshot = createStateSnapshot(collector, now)
    listeners.forEach((listener) => listener(snapshot))
  }

  const trimUndo = () => {
    const capacity = Math.max(0, config.capacity)
    if (capacity === 0) {
      collector.undo = []
      return
    }
    if (collector.undo.length > capacity) {
      collector.undo.splice(0, collector.undo.length - capacity)
    }
  }

  const resetTransaction = () => {
    collector.txBefore = undefined
    collector.txAfter = undefined
    collector.txOrigin = undefined
    collector.txTimestamp = undefined
  }

  const shouldCaptureOrigin = (origin?: Origin): boolean => {
    if (origin === 'system' && !config.captureSystem) return false
    if (origin === 'remote' && !config.captureRemote) return false
    return true
  }

  const pushUndo = (entry: HistoryEntry) => {
    collector.undo.push(entry)
    collector.redo = []
    trimUndo()
    emit()
  }

  const syncSnapshot = () => {
    lastSnapshot = cloneDocument(state.getDocument())
  }

  const applySnapshot = (document: Document) => {
    applyDocumentSnapshot(document)
    syncSnapshot()
  }

  const undo = (): boolean => {
    if (!collector.undo.length) {
      emit()
      return false
    }
    const entry = collector.undo.pop()
    if (!entry) return false
    collector.isApplying = true
    emit()
    try {
      applySnapshot(entry.before)
      collector.redo.push(entry)
    } finally {
      collector.isApplying = false
      emit()
    }
    return true
  }

  const redo = (): boolean => {
    if (!collector.redo.length) {
      emit()
      return false
    }
    const entry = collector.redo.pop()
    if (!entry) return false
    collector.isApplying = true
    emit()
    try {
      applySnapshot(entry.after)
      collector.undo.push(entry)
      trimUndo()
    } finally {
      collector.isApplying = false
      emit()
    }
    return true
  }

  const clear = () => {
    collector.isApplying = false
    collector.undo = []
    collector.redo = []
    collector.txDepth = 0
    resetTransaction()
    syncSnapshot()
    emit()
  }

  const configure = (nextConfig: Partial<CoreHistoryConfig>) => {
    const previousCapacity = config.capacity
    if (typeof nextConfig.enabled === 'boolean') config.enabled = nextConfig.enabled
    if (typeof nextConfig.capacity === 'number') config.capacity = Math.max(0, nextConfig.capacity)
    if (typeof nextConfig.captureSystem === 'boolean') config.captureSystem = nextConfig.captureSystem
    if (typeof nextConfig.captureRemote === 'boolean') config.captureRemote = nextConfig.captureRemote
    if (previousCapacity !== config.capacity) {
      trimUndo()
      emit()
    }
  }

  const getState = (): CoreHistoryState => createStateSnapshot(collector, now)

  const subscribe = (listener: (snapshot: CoreHistoryState) => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const afterHandler: ChangeHandlers['after'][number] = ({ changes }) => {
    const before = lastSnapshot
    const after = cloneDocument(state.getDocument())
    lastSnapshot = after

    if (!config.enabled) return
    if (collector.isApplying) return
    if (!shouldCaptureOrigin(changes.origin)) return

    if (collector.txDepth > 0) {
      collector.txBefore ??= before
      collector.txAfter = after
      collector.txOrigin ??= changes.origin
      collector.txTimestamp ??= changes.timestamp
      return
    }

    pushUndo({
      before,
      after,
      timestamp: changes.timestamp,
      origin: changes.origin,
      source: 'single'
    })
  }

  const transactionStartHandler: ChangeHandlers['transactionStart'][number] = () => {
    collector.txDepth += 1
    if (collector.txDepth === 1) {
      resetTransaction()
    }
  }

  const transactionEndHandler: ChangeHandlers['transactionEnd'][number] = () => {
    if (collector.txDepth <= 0) return
    collector.txDepth -= 1
    if (collector.txDepth > 0) return

    const txBefore = collector.txBefore
    const txAfter = collector.txAfter
    if (!txBefore || !txAfter) {
      resetTransaction()
      return
    }

    pushUndo({
      before: txBefore,
      after: txAfter,
      timestamp: collector.txTimestamp ?? now(),
      origin: collector.txOrigin,
      source: 'transaction'
    })
    resetTransaction()
  }

  changes.after.push(afterHandler)
  changes.transactionStart.push(transactionStartHandler)
  changes.transactionEnd.push(transactionEndHandler)

  return {
    syncSnapshot,
    commands: {
      undo,
      redo,
      clear,
      configure,
      getState,
      subscribe
    }
  }
}
