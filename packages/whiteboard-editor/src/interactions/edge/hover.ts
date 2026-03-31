import { createRafTask } from '@whiteboard/engine'
import type { Point } from '@whiteboard/core/types'
import type { PassiveInputProcessor } from '../../runtime/input/passive'
import type { FeatureRuntime } from '../../runtime/editor/createEditor'

type EdgeHoverProcessorDeps = Pick<
  FeatureRuntime,
  'query' | 'output'
>

export const createEdgeHoverProcessor = (
  ctx: EdgeHoverProcessorDeps
): PassiveInputProcessor => {
  let hoverPoint: Point | null = null

  const clearHint = () => {
    ctx.output.edgeGuide.clear()
  }

  const hoverTask = createRafTask(() => {
    if (!hoverPoint) {
      clearHint()
      return
    }

    if (ctx.query.interaction.mode.get() !== 'idle') {
      clearHint()
      return
    }

    const target = ctx.output.snap.edge.connect(hoverPoint)
    ctx.output.edgeGuide.set(
      target
        ? { snap: target.pointWorld }
        : undefined
    )
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
