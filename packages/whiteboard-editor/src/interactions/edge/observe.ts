import { createRafTask } from '@whiteboard/engine'
import type { InteractionObserve } from '../../runtime/interaction'
import { clearEdgeGuide } from './overlay'
import type { EdgeInteractionCtx } from './types'

export const createEdgeObserve = (
  ctx: EdgeInteractionCtx
): InteractionObserve => {
  let hoverPoint: import('@whiteboard/core/types').Point | null = null

  const hoverTask = createRafTask(() => {
    if (!hoverPoint) {
      clearEdgeGuide(ctx)
      return
    }

    const target = ctx.snap.edge.connect(hoverPoint)
    ctx.overlay.set((current) => ({
      ...current,
      edge: {
        ...current.edge,
        guide: target
          ? { snap: target.pointWorld }
          : undefined
      }
    }))
  })

  return {
    move: (input) => {
      if (ctx.read.tool.get().type !== 'edge') {
        hoverTask.cancel()
        hoverPoint = null
        clearEdgeGuide(ctx)
        return
      }

      hoverPoint = input.world
      hoverTask.schedule()
    },
    leave: () => {
      hoverTask.cancel()
      hoverPoint = null
      clearEdgeGuide(ctx)
    },
    blur: () => {
      hoverTask.cancel()
      hoverPoint = null
      clearEdgeGuide(ctx)
    },
    cancel: () => {
      hoverTask.cancel()
      hoverPoint = null
      clearEdgeGuide(ctx)
    }
  }
}
