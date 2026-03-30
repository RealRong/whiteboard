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
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  GestureTuning,
  type InteractionPointerInput,
  type InteractionRegistration,
  type RuntimeSession,
} from '../../runtime/interaction'
import type { PointerDown } from '../../runtime/input/pointer'
import type { EditorFeatureContext } from '../../types/runtime/editor/featureContext'
import type { MarqueeEnd, MarqueeInteraction } from './marquee'
import { createNodeDragInteraction, type NodeDragStart } from '../node/drag/interaction'
import type { NodeId } from '@whiteboard/core/types'

export type SelectionPressInteraction = {
  interaction: InteractionRegistration<SelectionPressState>
  clear: () => void
}

type SelectionPressField = NonNullable<PointerDown['field']>

type SelectionPressState = {
  plan: SelectionPressPlan<SelectionPressField> | undefined
  start: {
    clientX: number
    clientY: number
  }
  holdTimer: number | null
}

type SelectionPressInteractionDeps = Pick<
  EditorFeatureContext,
  'read' | 'commands' | 'config' | 'viewport' | 'projection' | 'spatial'
>

const EMPTY_SELECTION = normalizeSelectionTarget({})

const buildSelectionWriter = (
  ctx: SelectionPressInteractionDeps,
  base: SelectionTarget,
  mode: SelectionMode
) => {
  return (matched: SelectionTarget) => {
    ctx.commands.selection.replace({
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
  ctx: SelectionPressInteractionDeps,
  verifyNodeIds: readonly NodeId[] | undefined,
  event: PointerEvent
) => {
  if (!verifyNodeIds?.length) {
    return true
  }

  const targetPick = ctx.spatial.pick.element(
    event.target instanceof Element ? event.target : null
  )

  return (
    targetPick?.kind === 'node'
    && verifyNodeIds.includes(targetPick.id)
  )
}

const stopPointerDown = (
  event: PointerEvent
) => {
  if (event.cancelable) {
    event.preventDefault()
  }
  event.stopPropagation()
}

const clearHoldTimer = (
  state: SelectionPressState
) => {
  if (state.holdTimer === null || typeof window === 'undefined') {
    return
  }

  window.clearTimeout(state.holdTimer)
  state.holdTimer = null
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
        const node = ctx.read.node.item.get(input.pick.id)?.node
        subject.shell = node
          ? ctx.read.node.role(node)
          : 'content'
      }

      return subject
    }
    case 'edge':
    case 'mindmap':
      return undefined
  }
}

export const createSelectionPressInteraction = (
  ctx: SelectionPressInteractionDeps,
  marquee: MarqueeInteraction
): SelectionPressInteraction => {
  const drag = createNodeDragInteraction(ctx)

  const clear = () => {
    marquee.clear()
    drag.clear()
  }

  const buildMarqueeInput = (
    start: PointerDown,
    action: Extract<SelectionDragAction, { kind: 'marquee' }>,
    extra?: {
      onStart?: () => void
    }
  ) => {
    const applyMatched = buildSelectionWriter(ctx, action.base, action.mode)
    return {
      pointerId: start.event.pointerId,
      capture: start.capture,
      start: ctx.viewport.pointer({
        clientX: start.event.clientX,
        clientY: start.event.clientY
      }),
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
    session: RuntimeSession,
    start: PointerDown,
    action: Extract<SelectionDragAction, { kind: 'marquee' }>,
    moveEvent?: PointerEvent,
    extra?: {
      onStart?: () => void
    }
  ) => {
    const nextInput = buildMarqueeInput(start, action, extra)
    const replaced = session.replace({
      registration: marquee.interaction,
      input: nextInput,
      state: marquee.createState(nextInput)
    })

    if (replaced && moveEvent?.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const replaceWithContainMarquee = (
    session: RuntimeSession,
    start: PointerDown
  ) => {
    replaceWithMarquee(session, start, {
      kind: 'marquee',
      match: 'contain',
      mode: 'replace',
      base: EMPTY_SELECTION
    }, undefined, {
      onStart: () => {
        ctx.commands.selection.clear()
      }
    })
  }

  const replaceWithMove = (
    session: RuntimeSession,
    start: PointerDown,
    action: Extract<SelectionDragAction, { kind: 'move' }>,
    event: PointerEvent
  ) => {
    const nextInput: NodeDragStart = {
      pointerId: start.event.pointerId,
      capture: start.capture,
      start: start.point.world,
      frame: action.frame,
      anchorId: action.anchorId,
      nodeIds: action.target.nodeIds,
      edgeIds: action.target.edgeIds,
      event,
      onStart: action.nextSelection
        ? () => {
            ctx.commands.selection.replace(action.nextSelection!)
          }
        : undefined
    }
    const nextState = drag.createState(nextInput)
    if (!nextState) {
      return
    }

    session.replace({
      registration: drag.interaction,
      input: nextInput,
      state: nextState
    })
  }

  const runTapAction = (
    action: SelectionTapAction<SelectionPressField>,
    event: PointerEvent
  ) => {
    switch (action.kind) {
      case 'clear':
        ctx.commands.selection.clear()
        return
      case 'select':
        if (!matchesTapTarget(ctx, action.verifyNodeIds, event)) {
          return
        }

        ctx.commands.selection.replace(action.target)
        return
      case 'edit':
        if (!matchesTapTarget(ctx, action.verifyNodeIds, event)) {
          return
        }

        ctx.commands.edit.start(action.nodeId, action.field)
        return
    }
  }

  const interaction: InteractionRegistration<SelectionPressState> = {
    key: 'selection.press',
    priority: 100,
    mode: 'press',
    chrome: (state) => Boolean(state.plan?.chrome),
    can: (input) => {
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
        getNode: (nodeId) => ctx.read.node.item.get(nodeId)?.node,
        getOwnerId: ctx.read.node.owner,
        getNodeFrame: ctx.read.node.frame
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
          clientX: input.event.clientX,
          clientY: input.event.clientY
        },
        holdTimer: null
      }
    },
    start: ({ input, state, session }) => {
      stopPointerDown(input.event)

      if (
        !state.plan?.allowHold
        || typeof window === 'undefined'
      ) {
        return
      }

      state.holdTimer = window.setTimeout(() => {
        state.holdTimer = null
        replaceWithContainMarquee(session, input)
      }, GestureTuning.holdDelay)
    },
    move: ({ input, state, session }, event: InteractionPointerInput) => {
      if (!state.plan) {
        session.finish()
        return
      }

      const dx = Math.abs(event.client.x - state.start.clientX)
      const dy = Math.abs(event.client.y - state.start.clientY)
      if (
        dx < GestureTuning.dragMinDistance
        && dy < GestureTuning.dragMinDistance
      ) {
        return
      }

      clearHoldTimer(state)

      if (!state.plan.drag) {
        session.finish()
        return
      }

      if (state.plan.drag.kind === 'move') {
        replaceWithMove(session, input, state.plan.drag, event.raw)
        return
      }

      replaceWithMarquee(session, input, state.plan.drag, event.raw)
    },
    up: ({ state, session }, event: InteractionPointerInput) => {
      clearHoldTimer(state)

      if (state.plan?.tap) {
        runTapAction(state.plan.tap, event.raw)
      }

      session.finish()
    },
    cancel: ({ state }) => {
      clearHoldTimer(state)
    },
    cleanup: ({ state }) => {
      if (state) {
        clearHoldTimer(state)
      }
    }
  }

  return {
    interaction,
    clear
  }
}
