import {
  EMPTY_SELECTION_TARGET,
  resolveSelectionPressPlan,
  type SelectionDragAction,
  type SelectionPressPlan,
  type SelectionPressSubject,
  type SelectionTapAction,
  type SelectionTarget
} from '@whiteboard/core/selection'
import type { TimeoutTask } from '@whiteboard/engine'
import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type { PointerDown } from '../runtime/input/pointer'
import type { InteractionPointerInput } from '../runtime/interaction'
import type { InteractionHost } from '../runtime/interaction/host'
import type {
  MarqueeEnd,
  MarqueeStartInput
} from './marquee'

export type SelectionPressField = NonNullable<PointerDown['field']>

export type SelectionPressState = {
  plan: SelectionPressPlan<SelectionPressField> | undefined
  start: {
    clientX: number
    clientY: number
  }
  holdTask: TimeoutTask | null
}

export type SelectionHelperDeps = Pick<
  InteractionHost,
  'read' | 'commands'
>

export const EMPTY_SELECTION = EMPTY_SELECTION_TARGET

const buildSelectionWriter = (
  ctx: SelectionHelperDeps,
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

export const clearHoldTask = (
  state: SelectionPressState
) => {
  if (state.holdTask === null) {
    return
  }

  state.holdTask.cancel()
  state.holdTask = null
}

const toSelectionPressSubject = (
  ctx: SelectionHelperDeps,
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

export const hasMovedEnough = (
  state: SelectionPressState,
  input: InteractionPointerInput,
  minDistance: number
) => {
  const dx = Math.abs(input.client.x - state.start.clientX)
  const dy = Math.abs(input.client.y - state.start.clientY)

  return dx >= minDistance || dy >= minDistance
}

export const createSelectionMarqueeInput = (
  ctx: SelectionHelperDeps,
  start: PointerDown,
  action: Extract<SelectionDragAction, { kind: 'marquee' }>,
  extra?: {
    onStart?: () => void
  }
): MarqueeStartInput => {
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

export const runTapAction = (
  ctx: SelectionHelperDeps,
  action: SelectionTapAction<SelectionPressField>,
  input: InteractionPointerInput
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
  ctx: SelectionHelperDeps,
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
      clientX: input.point.client.x,
      clientY: input.point.client.y
    },
    holdTask: null
  }
}
