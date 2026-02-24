import type { Rect } from '@whiteboard/core/types'
import type { PointerSession } from '@engine-types/input'
import { rectFromPoints } from '@whiteboard/core/geometry'
import { resolveSelectionMode } from '../shared/selection'

export const createSelectionBox = (): PointerSession => ({
  kind: 'selectionBox',
  priority: 50,
  canStart: (event, context) => {
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    if (event.modifiers.space) return false
    if (context.state.read('tool') === 'edge') return false
    return event.target.role === 'background'
  },
  start: (event, context) => {
    const mode = resolveSelectionMode(event.modifiers)
    const pointerId = event.pointerId
    const startPoint = event.pointer.screen
    const startWorld = event.pointer.world
    let isSelecting = false
    let latestRectWorld: Rect | null = null
    let latestContext: typeof context | null = null
    let scheduled = false
    const clearPending = () => {
      latestRectWorld = null
      latestContext = null
      scheduled = false
    }
    const flushSelection = () => {
      scheduled = false
      const rectWorld = latestRectWorld
      const nextContext = latestContext
      latestRectWorld = null
      latestContext = null
      if (!rectWorld || !nextContext) return
      const matched = nextContext.query.canvas.nodeIdsInRect(rectWorld)
      if (!matched.length) return
      nextContext.commands.selection.select(matched, mode)
    }

    context.commands.selection.beginBox(mode)
    return {
      pointerId,
      update: (nextEvent, nextContext) => {
        const minDragDistance = nextContext.config.node.selectionMinDragDistance
        const dx = Math.abs(nextEvent.pointer.screen.x - startPoint.x)
        const dy = Math.abs(nextEvent.pointer.screen.y - startPoint.y)
        if (!isSelecting && dx < minDragDistance && dy < minDragDistance) {
          return
        }

        const rectScreen = rectFromPoints(startPoint, nextEvent.pointer.screen)
        const rectWorld = rectFromPoints(startWorld, nextEvent.pointer.world)

        isSelecting = true
        latestRectWorld = rectWorld
        latestContext = nextContext
        nextContext.commands.selection.updateBox(rectScreen, rectWorld)

        if (scheduled) {
          return
        }
        scheduled = true
        nextContext.state.batchFrame(flushSelection)
      },
      end: (_nextEvent, nextContext) => {
        if (!isSelecting && mode === 'replace') {
          nextContext.commands.selection.clear()
        }
        clearPending()
        nextContext.commands.selection.endBox()
      },
      cancel: (_reason, nextContext) => {
        clearPending()
        nextContext.commands.selection.endBox()
      }
    }
  }
})
