import type { Point } from '@whiteboard/core/types'
import type { EditorRuntime } from '../../types/internal/editor'
import type { SnapRuntime } from '../../runtime/interaction'
import type { PassiveInputProcessor } from '../../runtime/input/passive'
import { createRafTask } from '../../runtime/utils/rafTask'
import type { EdgeProjection } from './projection'

type EdgeHoverProcessorDeps = Pick<
  EditorRuntime,
  'interaction'
> & {
  internals: {
    projections: {
      overlay: {
        edge: Pick<EdgeProjection, 'hint'>
      }
    }
    snap: Pick<SnapRuntime, 'edge'>
  }
}

export const createEdgeHoverProcessor = (
  editor: EdgeHoverProcessorDeps
): PassiveInputProcessor => {
  let hoverPoint: Point | null = null

  const clearHint = () => {
    editor.internals.projections.overlay.edge.hint.clear()
  }

  const hoverTask = createRafTask(() => {
    if (!hoverPoint) {
      clearHint()
      return
    }

    if (editor.interaction.mode.get() !== 'idle') {
      clearHint()
      return
    }

    const target = editor.internals.snap.edge.connect(hoverPoint)
    editor.internals.projections.overlay.edge.hint.set(
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
