import type { Operation, Origin } from '@whiteboard/core/types'
import type { ResolvedHistoryConfig } from '@engine-types/common'
import type { HistoryState } from '@engine-types/state'
import { DEFAULT_CONFIG } from '../config'

type HistoryEntry = {
  forward: Operation[]
  inverse: Operation[]
  origin: Origin
  timestamp: number
}

type HistoryCaptureInput = {
  forward: Operation[]
  inverse: Operation[]
  origin: Origin
  timestamp: number
}

type ApplyEntry = (operations: Operation[]) => boolean

export type HistoryStore = {
  configure: (config: Partial<ResolvedHistoryConfig>) => void
  clear: () => void
  capture: (input: HistoryCaptureInput) => void
  undo: (apply: ApplyEntry) => boolean
  redo: (apply: ApplyEntry) => boolean
  getState: () => HistoryState
  subscribe: (listener: (state: HistoryState) => void) => () => void
}

type CreateHistoryStoreOptions = {
  now?: () => number
}

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (clone) {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const cloneOperations = (operations: Operation[]) => cloneValue(operations)

const shouldCaptureOrigin = (
  config: ResolvedHistoryConfig,
  origin: Origin
) => {
  if (origin === 'system' && !config.captureSystem) return false
  if (origin === 'remote' && !config.captureRemote) return false
  return true
}

export const createHistoryStore = (
  options: CreateHistoryStoreOptions = {}
): HistoryStore => {
  const now = options.now ?? (() => Date.now())
  const listeners = new Set<(state: HistoryState) => void>()
  const config: ResolvedHistoryConfig = {
    enabled: DEFAULT_CONFIG.history.enabled,
    capacity: DEFAULT_CONFIG.history.capacity,
    captureSystem: DEFAULT_CONFIG.history.captureSystem,
    captureRemote: DEFAULT_CONFIG.history.captureRemote
  }

  let undoStack: HistoryEntry[] = []
  let redoStack: HistoryEntry[] = []
  let isApplying = false
  let lastUpdatedAt: number | undefined

  const getState = (): HistoryState => ({
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoDepth: undoStack.length,
    redoDepth: redoStack.length,
    isApplying,
    lastUpdatedAt
  })

  const emit = () => {
    lastUpdatedAt = now()
    const snapshot = getState()
    listeners.forEach((listener) => listener(snapshot))
  }

  const trimUndo = () => {
    const capacity = Math.max(0, config.capacity)
    if (capacity === 0) {
      undoStack = []
      return
    }
    if (undoStack.length > capacity) {
      undoStack.splice(0, undoStack.length - capacity)
    }
  }

  const pushUndo = (entry: HistoryEntry) => {
    undoStack.push(entry)
    redoStack = []
    trimUndo()
    emit()
  }

  return {
    configure: (nextConfig) => {
      const previousCapacity = config.capacity

      if (typeof nextConfig.enabled === 'boolean') {
        config.enabled = nextConfig.enabled
      }
      if (typeof nextConfig.capacity === 'number') {
        config.capacity = Math.max(0, nextConfig.capacity)
      }
      if (typeof nextConfig.captureSystem === 'boolean') {
        config.captureSystem = nextConfig.captureSystem
      }
      if (typeof nextConfig.captureRemote === 'boolean') {
        config.captureRemote = nextConfig.captureRemote
      }

      if (previousCapacity !== config.capacity) {
        trimUndo()
      }
      emit()
    },
    clear: () => {
      undoStack = []
      redoStack = []
      isApplying = false
      emit()
    },
    capture: ({ forward, inverse, origin, timestamp }) => {
      if (!config.enabled) return
      if (isApplying) return
      if (!shouldCaptureOrigin(config, origin)) return
      if (!forward.length || !inverse.length) return

      pushUndo({
        forward: cloneOperations(forward),
        inverse: cloneOperations(inverse),
        origin,
        timestamp
      })
    },
    undo: (apply) => {
      if (!undoStack.length) {
        emit()
        return false
      }

      const entry = undoStack.pop()
      if (!entry) return false

      isApplying = true
      emit()
      try {
        const ok = apply(cloneOperations(entry.inverse))
        if (!ok) {
          undoStack.push(entry)
          return false
        }
        redoStack.push(entry)
      } finally {
        isApplying = false
        emit()
      }
      return true
    },
    redo: (apply) => {
      if (!redoStack.length) {
        emit()
        return false
      }

      const entry = redoStack.pop()
      if (!entry) return false

      isApplying = true
      emit()
      try {
        const ok = apply(cloneOperations(entry.forward))
        if (!ok) {
          redoStack.push(entry)
          return false
        }
        undoStack.push(entry)
        trimUndo()
      } finally {
        isApplying = false
        emit()
      }
      return true
    },
    getState,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
