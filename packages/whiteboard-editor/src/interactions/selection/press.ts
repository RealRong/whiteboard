import {
  matchSelectionRelease,
  resolveSelectionPressDecision,
  type SelectionPressDecision,
  type SelectionPressSubject,
  type SelectionPressTarget,
  type SelectionReleaseDecision
} from '@whiteboard/core/selection'
import { createTimeoutTask, type TimeoutTask } from '@whiteboard/engine'
import {
  GestureTuning,
  type InteractionCtx,
  type InteractionControl,
  type InteractionSession
} from '../../runtime/interaction'
import type {
  PointerDownInput,
  PointerMoveInput,
  PointerUpInput
} from '../../types/input'
import { createMarqueeInteraction } from './marquee'
import { createMoveInteraction } from './move'

type SelectionPressField = NonNullable<PointerDownInput['field']>
type SelectionPointer = PointerDownInput | PointerMoveInput | PointerUpInput
type SelectionInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'state' | 'config' | 'commands' | 'overlay' | 'snap'
>

export type SelectionPressState = {
  target: SelectionPressTarget<SelectionPressField>
  decision: SelectionPressDecision<SelectionPressField>
  start: {
    clientX: number
    clientY: number
  }
  holdTask: TimeoutTask | null
}

const toPanPointer = (
  input: PointerMoveInput
) => ({
  clientX: input.client.x,
  clientY: input.client.y
})

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
  input: SelectionPointer
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

const hasMovedEnough = (
  state: SelectionPressState,
  input: PointerMoveInput
) => {
  const dx = Math.abs(input.client.x - state.start.clientX)
  const dy = Math.abs(input.client.y - state.start.clientY)

  return dx >= GestureTuning.dragMinDistance || dy >= GestureTuning.dragMinDistance
}

const runRelease = (
  ctx: SelectionInteractionCtx,
  action: SelectionReleaseDecision<SelectionPressField>
) => {
  switch (action.kind) {
    case 'clear':
      ctx.commands.selection.clear()
      return
    case 'select':
      ctx.commands.selection.replace(action.target)
      return
    case 'edit':
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

  const resolved = resolveSelectionPressDecision({
    getNode: (nodeId) => ctx.read.node.item.get(nodeId)?.node,
    getOwnerId: ctx.read.node.owner
  }, {
    modifiers: input.modifiers,
    selection: ctx.read.selection.summary.get(),
    subject
  })
  if (!resolved) {
    return null
  }

  return {
    target: resolved.target,
    decision: resolved.decision,
    start: {
      clientX: input.client.x,
      clientY: input.client.y
    },
    holdTask: null
  }
}

const startDecisionDrag = (
  ctx: SelectionInteractionCtx,
  start: PointerDownInput,
  state: SelectionPressState,
  pointer: PointerMoveInput | undefined
) => {
  const drag = pointer
    ? state.decision.drag
    : state.decision.hold
  if (!drag) {
    return null
  }

  if (drag.kind === 'move') {
    return pointer
      ? createMoveInteraction(ctx, {
          start,
          pointer,
          target: drag.target,
          prepareSelection: drag.prepareSelection
        })
      : null
  }

  return createMarqueeInteraction(ctx, {
    start,
    action: drag,
    initialInput: pointer
  })
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
    chrome: pressState.decision.chrome,
    move: (input) => {
      if (!hasMovedEnough(pressState, input)) {
        return
      }

      clearHoldTask(pressState)
      const next = startDecisionDrag(ctx, start, pressState, input)
      if (!next) {
        control.finish()
        return
      }

      transition(next, {
        pan: toPanPointer(input)
      })
    },
    up: (input) => {
      clearHoldTask(pressState)
      const release = pressState.decision.release
      if (!release) {
        return
      }

      const subject = toSelectionPressSubject(ctx, input)
      if (!matchSelectionRelease(pressState.target, subject)) {
        return
      }

      runRelease(ctx, release)
    },
    cancel: () => {
      clearHoldTask(pressState)
    },
    cleanup: () => {
      clearHoldTask(pressState)
    }
  }

  phase = pressPhase

  if (pressState.decision.hold) {
    pressState.holdTask = createTimeoutTask(() => {
      pressState.holdTask = null

      if (phase !== pressPhase) {
        return
      }

      const next = startDecisionDrag(ctx, start, pressState, undefined)
      if (!next) {
        return
      }

      transition(next)
    })
    pressState.holdTask.schedule(GestureTuning.holdDelay)
  }

  return pressPhase
}
