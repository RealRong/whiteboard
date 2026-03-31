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
  type InteractionRegistration,
  type RuntimeSession,
} from '../../runtime/interaction'
import type { PointerDown } from '../../runtime/input/pointer'
import type { FeatureRuntime } from '../../runtime/editor/featureRuntime'
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
  holdTask: TimeoutTask | null
}

type SelectionPressInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
>

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
          ? ctx.query.read.node.role(node)
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
    session: RuntimeSession,
    start: PointerDown,
    action: Extract<SelectionDragAction, { kind: 'marquee' }>,
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
    return replaced
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
    }, {
      onStart: () => {
        ctx.command.selection.clear()
      }
    })
  }

  const replaceWithMove = (
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
            ctx.command.selection.replace(action.nextSelection!)
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
        getNode: (nodeId) => ctx.query.read.node.item.get(nodeId)?.node,
        getOwnerId: ctx.query.read.node.owner,
        getNodeFrame: ctx.query.read.node.frame
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
    },
    start: ({ input, state, session }) => {
      if (!state.plan?.allowHold) {
        return
      }

      state.holdTask = createTimeoutTask(() => {
        state.holdTask = null
        replaceWithContainMarquee(session, input)
      })
      state.holdTask.schedule(GestureTuning.holdDelay)
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

      clearHoldTask(state)

      if (!state.plan.drag) {
        session.finish()
        return
      }

      if (state.plan.drag.kind === 'move') {
        replaceWithMove(session, input, state.plan.drag, event)
        return
      }

      replaceWithMarquee(session, input, state.plan.drag)
    },
    up: ({ state, session }, event: InteractionPointerInput) => {
      clearHoldTask(state)

      if (state.plan?.tap) {
        runTapAction(state.plan.tap, event)
      }

      session.finish()
    },
    cancel: ({ state }) => {
      clearHoldTask(state)
    },
    cleanup: ({ state }) => {
      if (state) {
      clearHoldTask(state)
      }
    }
  }

  return {
    interaction,
    clear
  }
}
