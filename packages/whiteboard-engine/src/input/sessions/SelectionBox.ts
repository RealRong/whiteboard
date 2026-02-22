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
    let rafId: number | null = null
    const cancelPendingRaf = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
      latestRectWorld = null
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
        nextContext.commands.selection.updateBox(rectScreen, rectWorld)

        if (rafId !== null) {
          return
        }

        rafId = window.requestAnimationFrame(() => {
          rafId = null
          const latest = latestRectWorld
          if (!latest) return

          const matched = nextContext.query.canvas.nodeIdsInRect(latest)
          if (!matched.length) return
          nextContext.commands.selection.select(matched, mode)
        })
      },
      end: (_nextEvent, nextContext) => {
        if (!isSelecting && mode === 'replace') {
          nextContext.commands.selection.clear()
        }
        cancelPendingRaf()
        nextContext.commands.selection.endBox()
      },
      cancel: (_reason, nextContext) => {
        cancelPendingRaf()
        nextContext.commands.selection.endBox()
      }
    }
  }
})
