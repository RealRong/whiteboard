import {
  EMPTY_SELECTION_TARGET,
  resolveSelectionPressPlan,
  type SelectionPressPlan,
  type SelectionPressSubject,
  type SelectionTapAction
} from '@whiteboard/core/selection'
import { createTimeoutTask, type TimeoutTask } from '@whiteboard/engine'
import {
  GestureTuning,
  type InteractionControl,
  type InteractionSession
} from '../../runtime/interaction'
import type { PointerDownInput } from '../../types/input'
import { createMarqueeInteraction, createSelectionMarqueeInput } from './marquee'
import { createDragInteraction } from './drag'
import type { SelectionInteractionCtx, SessionPointer } from './context'

type SelectionPressField = NonNullable<PointerDownInput['field']>

export type SelectionPressState = {
  plan: SelectionPressPlan<SelectionPressField> | undefined
  start: {
    clientX: number
    clientY: number
  }
  holdTask: TimeoutTask | null
}

const toPanPointer = (
  input: SessionPointer
) => ({
  clientX: input.client.x,
  clientY: input.client.y
})

const matchesTapTarget = (
  verifyNodeIds: readonly string[] | undefined,
  input: SessionPointer
) => {
  if (!verifyNodeIds?.length) {
    return true
  }

  return (
    input.pick.kind === 'node'
    && verifyNodeIds.includes(input.pick.id)
  )
}

const clearHoldTask = (
  state: SelectionPressState
) => {
  if (state.holdTask === null) {
    return
  }

  state.holdTask.cancel()
  state.holdTask = null
}

const toSelectionPressSubject = (
  ctx: SelectionInteractionCtx,
  input: PointerDownInput
): SelectionPressSubject<SelectionPressField> | undefined => {
  switch (input.pick.kind) {
    case 'background':
      return {
        kind: 'background'
      }
    case 'selection-box':
      return {
        kind: 'selection-box',
        part: input.pick.part
      }
    case 'node': {
      if (input.pick.part !== 'body' && input.pick.part !== 'shell') {
        return undefined
      }

      const subject: SelectionPressSubject<SelectionPressField> = {
        kind: 'node',
        nodeId: input.pick.id,
        part: input.pick.part,
        field: input.field
      }

      if (input.pick.part === 'shell') {
        const node = ctx.read.node.item.get(input.pick.id)?.node
        subject.shell = node
          ? ctx.read.node.capability(node).role
          : 'content'
      }

      return subject
    }
    case 'edge':
    case 'mindmap':
      return undefined
  }
}

const hasSelectionMovedEnough = (
  state: SelectionPressState,
  input: SessionPointer,
  minDistance: number
) => {
  const dx = Math.abs(input.client.x - state.start.clientX)
  const dy = Math.abs(input.client.y - state.start.clientY)

  return dx >= minDistance || dy >= minDistance
}

const runTapAction = (
  ctx: SelectionInteractionCtx,
  action: SelectionTapAction<SelectionPressField>,
  input: SessionPointer
) => {
  switch (action.kind) {
    case 'clear':
      ctx.commands.selection.clear()
      return
    case 'select':
      if (!matchesTapTarget(action.verifyNodeIds, input)) {
        return
      }

      ctx.commands.selection.replace(action.target)
      return
    case 'edit':
      if (!matchesTapTarget(action.verifyNodeIds, input)) {
        return
      }

      ctx.commands.edit.start(action.nodeId, action.field)
  }
}

export const resolveSelectionPressState = (
  ctx: SelectionInteractionCtx,
  input: PointerDownInput
): SelectionPressState | null => {
  const tool = ctx.read.tool.get()

  if (
    tool.type !== 'select'
    || input.pick.kind === 'edge'
    || input.pick.kind === 'mindmap'
    || input.editable
    || input.ignoreInput
    || input.ignoreSelection
  ) {
    return null
  }

  const subject = toSelectionPressSubject(ctx, input)
  if (!subject) {
    return null
  }

  const plan = resolveSelectionPressPlan({
    getNode: (nodeId) => ctx.read.node.item.get(nodeId)?.node,
    getOwnerId: ctx.read.node.owner,
    getNodeFrame: ctx.read.node.outline
  }, {
    modifiers: input.modifiers,
    selection: ctx.read.selection.get().summary,
    subject
  })
  if (!plan) {
    return null
  }

  return {
    plan,
    start: {
      clientX: input.client.x,
      clientY: input.client.y
    },
    holdTask: null
  }
}

export const createPressInteraction = (
  ctx: SelectionInteractionCtx,
  start: PointerDownInput,
  pressState: SelectionPressState,
  control: InteractionControl
): InteractionSession => {
  let phase: InteractionSession

  const transition = (
    next: InteractionSession,
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

  const pressPhase: InteractionSession = {
    mode: 'press',
    pointerId: start.pointerId,
    chrome: Boolean(pressState.plan?.chrome),
    move: (input) => {
      if (!pressState.plan) {
        control.finish()
        return
      }

      if (!hasSelectionMovedEnough(pressState, input, GestureTuning.dragMinDistance)) {
        return
      }

      clearHoldTask(pressState)

      if (!pressState.plan.drag) {
        control.finish()
        return
      }

      if (pressState.plan.drag.kind === 'move') {
        const next = createDragInteraction(ctx, {
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
        createMarqueeInteraction(
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
        createMarqueeInteraction(
          ctx,
          createSelectionMarqueeInput(
            ctx,
            start,
            {
              kind: 'marquee',
              match: 'contain',
              mode: 'replace',
              base: EMPTY_SELECTION_TARGET
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
      clearHoldTask(pressState)
      phase.cleanup?.()
    }
  }
}
