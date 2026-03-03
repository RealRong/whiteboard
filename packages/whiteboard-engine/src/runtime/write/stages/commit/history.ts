import type { Operation, Origin } from '@whiteboard/core/types'
import type { ResolvedHistoryConfig } from '@engine-types/common/config'
import type { HistoryState } from '@engine-types/state/model'
import type {
  HistoryApplyEntry,
  HistoryCaptureInput
} from '@engine-types/write/history'
import { DEFAULT_CONFIG } from '../../../../config'

type HistoryEntry = {
  forward: readonly Operation[]
  inverse: readonly Operation[]
  origin: Origin
  timestamp: number
}

type HistoryOptions = {
  now?: () => number
  onStateChange?: (state: HistoryState) => void
}

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (clone) {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const cloneOperations = (operations: readonly Operation[]) => cloneValue(operations)

const shouldCaptureOrigin = (
  config: ResolvedHistoryConfig,
  origin: Origin
) => {
  if (origin === 'system' && !config.captureSystem) return false
  if (origin === 'remote' && !config.captureRemote) return false
  return true
}

export class History {
  private readonly now: () => number
  private readonly onStateChange: (state: HistoryState) => void
  private readonly config: ResolvedHistoryConfig = {
    enabled: DEFAULT_CONFIG.history.enabled,
    capacity: DEFAULT_CONFIG.history.capacity,
    captureSystem: DEFAULT_CONFIG.history.captureSystem,
    captureRemote: DEFAULT_CONFIG.history.captureRemote
  }

  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private isApplying = false
  private lastUpdatedAt: number | undefined

  constructor(options: HistoryOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.onStateChange = options.onStateChange ?? (() => {})
  }

  private emit = () => {
    this.lastUpdatedAt = this.now()
    this.onStateChange(this.getState())
  }

  private trimUndo = () => {
    const capacity = Math.max(0, this.config.capacity)
    if (capacity === 0) {
      this.undoStack = []
      return
    }
    if (this.undoStack.length > capacity) {
      this.undoStack.splice(0, this.undoStack.length - capacity)
    }
  }

  private pushUndo = (entry: HistoryEntry) => {
    this.undoStack.push(entry)
    this.redoStack = []
    this.trimUndo()
    this.emit()
  }

  getState = (): HistoryState => ({
    canUndo: this.undoStack.length > 0,
    canRedo: this.redoStack.length > 0,
    undoDepth: this.undoStack.length,
    redoDepth: this.redoStack.length,
    isApplying: this.isApplying,
    lastUpdatedAt: this.lastUpdatedAt
  })

  configure = (nextConfig: Partial<ResolvedHistoryConfig>) => {
    const previousCapacity = this.config.capacity

    if (typeof nextConfig.enabled === 'boolean') {
      this.config.enabled = nextConfig.enabled
    }
    if (typeof nextConfig.capacity === 'number') {
      this.config.capacity = Math.max(0, nextConfig.capacity)
    }
    if (typeof nextConfig.captureSystem === 'boolean') {
      this.config.captureSystem = nextConfig.captureSystem
    }
    if (typeof nextConfig.captureRemote === 'boolean') {
      this.config.captureRemote = nextConfig.captureRemote
    }

    if (previousCapacity !== this.config.capacity) {
      this.trimUndo()
    }
    this.emit()
  }

  clear = () => {
    this.undoStack = []
    this.redoStack = []
    this.isApplying = false
    this.emit()
  }

  capture = ({
    forward,
    inverse,
    origin,
    timestamp
  }: HistoryCaptureInput) => {
    if (!this.config.enabled) return
    if (this.isApplying) return
    if (!shouldCaptureOrigin(this.config, origin)) return
    if (!forward.length || !inverse.length) return

    this.pushUndo({
      forward: cloneOperations(forward),
      inverse: cloneOperations(inverse),
      origin,
      timestamp
    })
  }

  undo = (apply: HistoryApplyEntry) => {
    if (!this.undoStack.length) {
      this.emit()
      return false
    }

    const entry = this.undoStack.pop()
    if (!entry) return false

    this.isApplying = true
    this.emit()
    try {
      const ok = apply(cloneOperations(entry.inverse))
      if (!ok) {
        this.undoStack.push(entry)
        return false
      }
      this.redoStack.push(entry)
    } finally {
      this.isApplying = false
      this.emit()
    }
    return true
  }

  redo = (apply: HistoryApplyEntry) => {
    if (!this.redoStack.length) {
      this.emit()
      return false
    }

    const entry = this.redoStack.pop()
    if (!entry) return false

    this.isApplying = true
    this.emit()
    try {
      const ok = apply(cloneOperations(entry.forward))
      if (!ok) {
        this.redoStack.push(entry)
        return false
      }
      this.undoStack.push(entry)
      this.trimUndo()
    } finally {
      this.isApplying = false
      this.emit()
    }
    return true
  }
}
