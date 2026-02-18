import type { Viewport } from '@whiteboard/core'
import type { Instance } from '@engine-types/instance/instance'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { HistoryState } from '@engine-types/state'

type Options = {
  state: Instance['state']
  emit: InstanceEventEmitter['emit']
}

export type StateEventsWatcher = {
  start: () => void
  stop: () => void
}

const isSameViewport = (left: Viewport, right: Viewport) =>
  left.zoom === right.zoom &&
  left.center.x === right.center.x &&
  left.center.y === right.center.y

const isSameHistory = (left: HistoryState, right: HistoryState) =>
  left.canUndo === right.canUndo &&
  left.canRedo === right.canRedo &&
  left.undoDepth === right.undoDepth &&
  left.redoDepth === right.redoDepth &&
  left.isApplying === right.isApplying &&
  left.lastUpdatedAt === right.lastUpdatedAt

const cloneViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const cloneHistory = (history: HistoryState): HistoryState => ({
  canUndo: history.canUndo,
  canRedo: history.canRedo,
  undoDepth: history.undoDepth,
  redoDepth: history.redoDepth,
  isApplying: history.isApplying,
  lastUpdatedAt: history.lastUpdatedAt
})

const isSameOptions = (
  left?: Record<string, unknown>,
  right?: Record<string, unknown>
) => {
  if (!left || !right) return !left && !right

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false
  }
  return true
}

const isSameMindmapLayout = (
  left: MindmapLayoutConfig,
  right: MindmapLayoutConfig
) =>
  left.mode === right.mode &&
  isSameOptions(
    left.options as Record<string, unknown> | undefined,
    right.options as Record<string, unknown> | undefined
  )

const cloneMindmapLayout = (
  layout: MindmapLayoutConfig
): MindmapLayoutConfig => ({
  mode: layout.mode,
  options: layout.options
    ? { ...layout.options }
    : undefined
})

export const createStateEvents = ({
  state,
  emit
}: Options): StateEventsWatcher => {
  let started = false
  let offToolWatch: (() => void) | null = null
  let offViewportWatch: (() => void) | null = null
  let offHistoryWatch: (() => void) | null = null
  let offMindmapLayoutWatch: (() => void) | null = null

  let lastTool: 'select' | 'edge' = 'select'
  let hasToolSnapshot = false
  let lastViewport: Viewport | null = null
  let lastHistory: HistoryState | null = null
  let lastMindmapLayout: MindmapLayoutConfig | null = null

  const emitToolChanged = (force = false) => {
    const tool = state.read('tool')
    const changed = !hasToolSnapshot || lastTool !== tool

    if (changed) {
      lastTool = tool
      hasToolSnapshot = true
    }

    if (!force && !changed) return
    emit('tool.changed', { tool })
  }

  const emitViewportChanged = (force = false) => {
    const viewport = state.read('viewport')
    const changed = !lastViewport || !isSameViewport(lastViewport, viewport)

    if (changed) {
      lastViewport = cloneViewport(viewport)
    }

    if (!force && !changed) return
    emit('viewport.changed', { viewport: cloneViewport(viewport) })
  }

  const emitHistoryChanged = (force = false) => {
    const history = state.read('history')
    const changed = !lastHistory || !isSameHistory(lastHistory, history)

    if (changed) {
      lastHistory = cloneHistory(history)
    }

    if (!force && !changed) return
    emit('history.changed', { history: cloneHistory(history) })
  }

  const emitMindmapLayoutChanged = (force = false) => {
    const layout = state.read('mindmapLayout')
    const changed =
      !lastMindmapLayout ||
      !isSameMindmapLayout(lastMindmapLayout, layout)

    if (changed) {
      lastMindmapLayout = cloneMindmapLayout(layout)
    }

    if (!force && !changed) return
    emit('mindmap.layout.changed', {
      layout: cloneMindmapLayout(layout)
    })
  }

  const emitCurrent = () => {
    if (!started) return
    emitToolChanged(true)
    emitViewportChanged(true)
    emitHistoryChanged(true)
    emitMindmapLayoutChanged(true)
  }

  const start = () => {
    if (started) return
    started = true

    if (!offToolWatch) {
      offToolWatch = state.watch('tool', () => emitToolChanged(false))
    }
    if (!offViewportWatch) {
      offViewportWatch = state.watch('viewport', () => emitViewportChanged(false))
    }
    if (!offHistoryWatch) {
      offHistoryWatch = state.watch('history', () => emitHistoryChanged(false))
    }
    if (!offMindmapLayoutWatch) {
      offMindmapLayoutWatch = state.watch(
        'mindmapLayout',
        () => emitMindmapLayoutChanged(false)
      )
    }

    emitCurrent()
  }

  const stop = () => {
    started = false
    offToolWatch?.()
    offToolWatch = null
    offViewportWatch?.()
    offViewportWatch = null
    offHistoryWatch?.()
    offHistoryWatch = null
    offMindmapLayoutWatch?.()
    offMindmapLayoutWatch = null
  }

  return {
    start,
    stop
  }
}
