import { createTimeoutTask } from '@whiteboard/engine'
import {
  GestureTuning,
  type ActiveInteraction,
  type InteractionRegistration
} from '../runtime/interaction'
import type { InteractionHost } from '../runtime/interaction/host'
import {
  startSelectionMarqueePhase
} from './marquee'
import {
  startMindmapDragPhase
} from './mindmap'
import {
  startNodeTransformPhase
} from './node/transform'
import {
  startNodeDragPhase
} from './node/drag'
import {
  EMPTY_SELECTION,
  clearHoldTask,
  createSelectionMarqueeInput,
  hasMovedEnough,
  resolveSelectionPressState,
  runTapAction,
  type SelectionHelperDeps
} from './selectionHelpers'

type SelectionInteractionDeps =
  SelectionHelperDeps
  & Pick<InteractionHost, 'config' | 'viewport' | 'overlay' | 'snap'>

export type SelectionInteraction = {
  interaction: InteractionRegistration
  clear: () => void
}

const clearSelectionFeedback = (
  ctx: SelectionInteractionDeps
) => {
  ctx.overlay.set((current) => (
    (
      current.node.patches.length === 0
      && current.node.hovered === undefined
      && current.edge.patches.length === 0
      && current.select.marquee === undefined
      && current.select.mindmapDrag === undefined
      && current.guides.snap.length === 0
    )
      ? current
      : {
          ...current,
          node: {
            ...current.node,
            patches: [],
            hovered: undefined
          },
          edge: {
            patches: []
          },
          select: {
            ...current.select,
            marquee: undefined,
            mindmapDrag: undefined
          },
          guides: {
            ...current.guides,
            snap: []
          }
        }
  ))
}

const toPanPointer = (
  input: Parameters<NonNullable<ActiveInteraction['move']>>[0]
) => ({
  clientX: input.client.x,
  clientY: input.client.y
})

export const createSelectionInteraction = (
  ctx: SelectionInteractionDeps
): SelectionInteraction => {
  const clear = () => {
    clearSelectionFeedback(ctx)
  }

  return {
    interaction: {
      key: 'selection',
      priority: 100,
      start: (start, control): ActiveInteraction | null => {
        const transformPhase = startNodeTransformPhase(ctx, start)
        if (transformPhase) {
          return transformPhase
        }

        const mindmapPhase = startMindmapDragPhase(ctx, start)
        if (mindmapPhase) {
          return mindmapPhase
        }

        const pressState = resolveSelectionPressState(ctx, start)
        if (!pressState) {
          return null
        }

        let phase: ActiveInteraction

        const transition = (
          next: ActiveInteraction,
          options?: {
            pan?: {
              clientX: number
              clientY: number
            }
          }
        ) => {
          phase = next
          control.update({
            mode: next.mode,
            chrome: next.chrome ?? false
          })

          if (options?.pan) {
            control.pan(options.pan)
          }
        }

        const pressPhase: ActiveInteraction = {
          mode: 'press',
          pointerId: start.pointerId,
          chrome: Boolean(pressState.plan?.chrome),
          move: (input) => {
            if (!pressState.plan) {
              control.finish()
              return
            }

            if (!hasMovedEnough(pressState, input, GestureTuning.dragMinDistance)) {
              return
            }

            clearHoldTask(pressState)

            if (!pressState.plan.drag) {
              control.finish()
              return
            }

            if (pressState.plan.drag.kind === 'move') {
              const next = startNodeDragPhase(ctx, {
                start,
                input,
                frame: pressState.plan.drag.frame,
                anchorId: pressState.plan.drag.anchorId,
                target: pressState.plan.drag.target,
                nextSelection: pressState.plan.drag.nextSelection
              })
              if (!next) {
                control.finish()
                return
              }

              transition(next, {
                pan: toPanPointer(input)
              })
              return
            }

            transition(
              startSelectionMarqueePhase(
                ctx,
                createSelectionMarqueeInput(
                  ctx,
                  start,
                  pressState.plan.drag
                ),
                {
                  initialInput: input
                }
              ),
              {
                pan: toPanPointer(input)
              }
            )
          },
          up: (input) => {
            clearHoldTask(pressState)
            if (pressState.plan?.tap) {
              runTapAction(ctx, pressState.plan.tap, input)
            }
          },
          cancel: () => {
            clearHoldTask(pressState)
          },
          cleanup: () => {
            clearHoldTask(pressState)
          }
        }

        phase = pressPhase

        if (pressState.plan?.allowHold) {
          pressState.holdTask = createTimeoutTask(() => {
            pressState.holdTask = null

            if (phase !== pressPhase) {
              return
            }

            transition(
              startSelectionMarqueePhase(
                ctx,
                createSelectionMarqueeInput(
                  ctx,
                  start,
                  {
                    kind: 'marquee',
                    match: 'contain',
                    mode: 'replace',
                    base: EMPTY_SELECTION
                  },
                  {
                    onStart: () => {
                      ctx.commands.selection.clear()
                    }
                  }
                )
              )
            )
          })
          pressState.holdTask.schedule(GestureTuning.holdDelay)
        }

        return {
          mode: 'press',
          pointerId: start.pointerId,
          chrome: Boolean(pressState.plan?.chrome),
          autoPan: {
            frame: (pointer) => {
              phase.autoPan?.frame?.(pointer)
            }
          },
          move: (input) => {
            const current = phase
            current.move?.(input)

            if (phase === current && current.autoPan) {
              control.pan(toPanPointer(input))
            }
          },
          up: (input) => {
            phase.up?.(input)
            control.finish()
          },
          cancel: () => {
            phase.cancel?.()
          },
          cleanup: () => {
            phase.cleanup?.()
          }
        }
      }
    },
    clear
  }
}
