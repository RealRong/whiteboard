import {
  resolveSelectionPressPlan,
  normalizeSelectionTarget,
  type SelectionDragAction,
  type SelectionPressPlan,
  type SelectionPressSubject,
  type SelectionTapAction,
  type SelectionTarget
} from '@whiteboard/core/selection'
import {
  createTimeoutTask,
  type TimeoutTask
} from '@whiteboard/engine'
import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  GestureTuning,
  type InteractionPointerInput,
  type RuntimeSession
} from '../runtime/interaction'
import type { PointerDown } from '../runtime/input/pointer'
import type { FeatureRuntime } from '../runtime/editor/createEditor'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeDragInteraction, NodeDragStart } from './node/drag'
import type { MarqueeEnd, MarqueeInteraction } from './marqueeRuntime'

export type SelectionPressField = NonNullable<PointerDown['field']>

export type SelectionPressState = {
  plan: SelectionPressPlan<SelectionPressField> | undefined
  start: {
    clientX: number
    clientY: number
  }
  holdTask: TimeoutTask | null
}

type SelectionPressInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
>

type SelectionPressRuntimeDeps = {
  ctx: SelectionPressInteractionDeps
  marquee: MarqueeInteraction
  drag: NodeDragInteraction
}

const EMPTY_SELECTION = normalizeSelectionTarget({})

const buildSelectionWriter = (
  ctx: SelectionPressInteractionDeps,
  base: SelectionTarget,
  mode: SelectionMode
) => {
  return (matched: SelectionTarget) => {
    ctx.command.selection.replace({
      nodeIds: [
        ...applySelection(
          new Set(base.nodeIds),
          [...matched.nodeIds],
          mode
        )
      ],
      edgeIds: [
        ...applySelection(
          new Set(base.edgeIds),
          [...matched.edgeIds],
          mode
        )
      ]
    })
  }
}

const matchesTapTarget = (
  verifyNodeIds: readonly NodeId[] | undefined,
  input: InteractionPointerInput
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
  ctx: SelectionPressInteractionDeps,
  input: PointerDown
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
        const node = ctx.query.read.node.item.get(input.pick.id)?.node
        subject.shell = node
          ? ctx.query.read.node.capability(node).role
          : 'content'
      }

      return subject
    }
    case 'edge':
    case 'mindmap':
      return undefined
  }
}

const buildMarqueeInput = (
  ctx: SelectionPressInteractionDeps,
  start: PointerDown,
  action: Extract<SelectionDragAction, { kind: 'marquee' }>,
  extra?: {
    onStart?: () => void
  }
) => {
  const applyMatched = buildSelectionWriter(ctx, action.base, action.mode)

  return {
    pointerId: start.pointerId,
    start: {
      screen: start.point.screen,
      world: start.point.world
    },
    match: action.match,
    onStart: extra?.onStart,
    onChange: applyMatched,
    onEnd: (result: MarqueeEnd) => {
      if (!result.moved) {
        return
      }

      applyMatched({
        nodeIds: result.nodeIds,
        edgeIds: result.edgeIds
      })
    }
  }
}

const replaceWithMarquee = (
  deps: SelectionPressRuntimeDeps,
  session: RuntimeSession,
  start: PointerDown,
  action: Extract<SelectionDragAction, { kind: 'marquee' }>,
  extra?: {
    onStart?: () => void
  }
) => {
  const nextInput = buildMarqueeInput(deps.ctx, start, action, extra)

  session.replace({
    registration: deps.marquee.interaction,
    input: nextInput,
    state: deps.marquee.createState(nextInput)
  })
}

const replaceWithContainMarquee = (
  deps: SelectionPressRuntimeDeps,
  session: RuntimeSession,
  start: PointerDown
) => {
  replaceWithMarquee(deps, session, start, {
    kind: 'marquee',
    match: 'contain',
    mode: 'replace',
    base: EMPTY_SELECTION
  }, {
    onStart: () => {
      deps.ctx.command.selection.clear()
    }
  })
}

const replaceWithMove = (
  deps: SelectionPressRuntimeDeps,
  session: RuntimeSession,
  start: PointerDown,
  action: Extract<SelectionDragAction, { kind: 'move' }>,
  input: InteractionPointerInput
) => {
  const nextInput: NodeDragStart = {
    pointerId: start.pointerId,
    startWorld: start.point.world,
    startClient: input.client,
    frame: action.frame,
    anchorId: action.anchorId,
    nodeIds: action.target.nodeIds,
    edgeIds: action.target.edgeIds,
    allowCross: input.altKey,
    onStart: action.nextSelection
      ? () => {
          deps.ctx.command.selection.replace(action.nextSelection!)
        }
      : undefined
  }
  const nextState = deps.drag.createState(nextInput)
  if (!nextState) {
    return
  }

  session.replace({
    registration: deps.drag.interaction,
    input: nextInput,
    state: nextState
  })
}

const runTapAction = (
  ctx: SelectionPressInteractionDeps,
  action: SelectionTapAction<SelectionPressField>,
  input: InteractionPointerInput
) => {
  switch (action.kind) {
    case 'clear':
      ctx.command.selection.clear()
      return
    case 'select':
      if (!matchesTapTarget(action.verifyNodeIds, input)) {
        return
      }

      ctx.command.selection.replace(action.target)
      return
    case 'edit':
      if (!matchesTapTarget(action.verifyNodeIds, input)) {
        return
      }

      ctx.command.edit.start(action.nodeId, action.field)
      return
  }
}

const hasMovedEnough = (
  state: SelectionPressState,
  event: InteractionPointerInput
) => {
  const dx = Math.abs(event.client.x - state.start.clientX)
  const dy = Math.abs(event.client.y - state.start.clientY)

  return (
    dx >= GestureTuning.dragMinDistance
    || dy >= GestureTuning.dragMinDistance
  )
}

export const resolveSelectionPressState = (
  ctx: SelectionPressInteractionDeps,
  input: PointerDown
): SelectionPressState | null => {
  if (
    input.tool.type !== 'select'
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
    getNode: (nodeId) => ctx.query.read.node.item.get(nodeId)?.node,
    getOwnerId: ctx.query.read.node.owner,
    getNodeFrame: ctx.query.read.node.outline
  }, {
    modifiers: input.modifiers,
    selection: ctx.query.read.selection.get().summary,
    subject
  })
  if (!plan) {
    return null
  }

  return {
    plan,
    start: {
      clientX: input.point.client.x,
      clientY: input.point.client.y
    },
    holdTask: null
  }
}

export const createSelectionPressRuntime = (
  deps: SelectionPressRuntimeDeps
) => {
  const clear = () => {
    deps.marquee.clear()
    deps.drag.clear()
  }

  const startHold = (
    input: PointerDown,
    state: SelectionPressState,
    session: RuntimeSession
  ) => {
    if (!state.plan?.allowHold) {
      return
    }

    state.holdTask = createTimeoutTask(() => {
      state.holdTask = null
      replaceWithContainMarquee(deps, session, input)
    })
    state.holdTask.schedule(GestureTuning.holdDelay)
  }

  const move = (
    input: PointerDown,
    state: SelectionPressState,
    session: RuntimeSession,
    event: InteractionPointerInput
  ) => {
    if (!state.plan) {
      session.finish()
      return
    }

    if (!hasMovedEnough(state, event)) {
      return
    }

    clearHoldTask(state)

    if (!state.plan.drag) {
      session.finish()
      return
    }

    if (state.plan.drag.kind === 'move') {
      replaceWithMove(deps, session, input, state.plan.drag, event)
      return
    }

    replaceWithMarquee(deps, session, input, state.plan.drag)
  }

  const up = (
    state: SelectionPressState,
    session: RuntimeSession,
    event: InteractionPointerInput
  ) => {
    clearHoldTask(state)

    if (state.plan?.tap) {
      runTapAction(deps.ctx, state.plan.tap, event)
    }

    session.finish()
  }

  const cancel = (
    state: SelectionPressState
  ) => {
    clearHoldTask(state)
  }

  const cleanup = (
    state?: SelectionPressState | null
  ) => {
    if (!state) {
      return
    }

    clearHoldTask(state)
  }

  return {
    clear,
    startHold,
    move,
    up,
    cancel,
    cleanup
  }
}
