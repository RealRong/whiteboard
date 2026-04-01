import { createRafTask } from '@whiteboard/engine'
import type { Point } from '@whiteboard/core/types'
import type { PassiveInputProcessor } from '../../runtime/input/passive'
import type { InteractionHost } from '../../runtime/interaction/host'

type EdgeHoverProcessorDeps = Pick<
  InteractionHost,
  'interaction' | 'overlay' | 'snap'
>

export const createEdgeHoverProcessor = (
  ctx: EdgeHoverProcessorDeps
): PassiveInputProcessor => {
  let hoverPoint: Point | null = null

  const clearHint = () => {
    ctx.overlay.set((current) => (
      current.guides.edge === undefined
        ? current
        : {
            ...current,
            guides: {
              ...current.guides,
              edge: undefined
            }
          }
    ))
  }

  const hoverTask = createRafTask(() => {
    if (!hoverPoint) {
      clearHint()
      return
    }

    if (ctx.interaction.mode.get() !== 'idle') {
      clearHint()
      return
    }

    const target = ctx.snap.edge.connect(hoverPoint)
    ctx.overlay.set((current) => ({
      ...current,
      guides: {
        ...current.guides,
        edge: target
          ? { snap: target.pointWorld }
          : undefined
      }
    }))
  })

  return {
    kind: 'edge.hover',
    when: (context) => (
      context.tool.type === 'edge'
      && context.mode === 'idle'
    ),
    move: (input) => {
      hoverPoint = input.point.world
      hoverTask.schedule()
    },
    leave: () => {
      hoverTask.cancel()
      hoverPoint = null
      clearHint()
    },
    blur: () => {
      hoverTask.cancel()
      hoverPoint = null
      clearHint()
    },
    cancel: () => {
      hoverTask.cancel()
      hoverPoint = null
      clearHint()
    }
  }
}
