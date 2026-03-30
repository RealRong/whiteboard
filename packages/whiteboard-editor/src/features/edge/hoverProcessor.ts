import { createRafTask } from '@whiteboard/engine'
import type { Point } from '@whiteboard/core/types'
import type { PassiveInputProcessor } from '../../runtime/input/passive'
import type { EditorFeatureContext } from '../../types/runtime/editor/featureContext'
import {
  clearEdgeProjectionHint,
  writeEdgeProjectionHint
} from './projection'

type EdgeHoverProcessorDeps = Pick<
  EditorFeatureContext,
  'interaction' | 'projection' | 'spatial'
>

export const createEdgeHoverProcessor = (
  ctx: EdgeHoverProcessorDeps
): PassiveInputProcessor => {
  let hoverPoint: Point | null = null

  const clearHint = () => {
    clearEdgeProjectionHint(ctx.projection.edge)
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

    const target = ctx.spatial.snap.edge.connect(hoverPoint)
    writeEdgeProjectionHint(
      ctx.projection.edge,
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
