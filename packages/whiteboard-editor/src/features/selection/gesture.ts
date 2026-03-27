import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  createPressRuntime,
  GestureTuning
} from '../../runtime/interaction'
import type { GestureDown } from '../../runtime/input/pointer'
import type { InternalInstance } from '../../runtime/instance'
import type { Input as SelectionInput } from '../../runtime/selection'
import {
  readSelectionPressContext,
  type SelectionPressContext,
  type SelectionPressIntent,
  type SelectionTapMatch
} from '../../runtime/selection/policy'
import type { MarqueeSession } from './marquee'
import { createNodeDragSession } from '../node/drag/session'

export type SelectionGesture = {
  down: (input: GestureDown) => boolean
  cancel: () => void
}

const isEmptySelection = (
  selection: SelectionInput
) => (
  (selection.nodeIds?.length ?? 0) === 0
  && (selection.edgeIds?.length ?? 0) === 0
)

const buildSelectionWriter = (
  instance: InternalInstance,
  base: SelectionInput,
  mode: SelectionMode
) => {
  return (matched: SelectionInput) => {
    instance.commands.selection.replace({
      nodeIds: [
        ...applySelection(
          new Set(base.nodeIds ?? []),
          [...(matched.nodeIds ?? [])],
          mode
        )
      ],
      edgeIds: [
        ...applySelection(
          new Set(base.edgeIds ?? []),
          [...(matched.edgeIds ?? [])],
          mode
        )
      ]
    })
  }
}

const matchesTapTarget = (
  instance: InternalInstance,
  match: SelectionTapMatch,
  event: PointerEvent
) => {
  const targetPick = instance.internals.pick.element(
    event.target instanceof Element ? event.target : null
  )

  return (
    targetPick?.kind === 'node'
    && (
      targetPick.id === match.hitNodeId
      || targetPick.id === match.nodeId
    )
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

export const createSelectionGesture = (
  instance: InternalInstance,
  marquee: MarqueeSession
): SelectionGesture => {
  const press = createPressRuntime(instance.interaction)
  const drag = createNodeDragSession(instance)

  const cancel = () => {
    press.cancel()
    drag.cancel()
    marquee.cancel()
  }

  const startMarquee = (
    ctx: SelectionPressContext,
    intent: Extract<SelectionPressIntent, { kind: 'marquee' }>,
    moveEvent?: PointerEvent
  ) => {
    if (
      intent.match === 'contain'
      && intent.mode === 'replace'
      && isEmptySelection(intent.base)
    ) {
      instance.commands.selection.clear()
    }

    const applyMatched = buildSelectionWriter(instance, intent.base, intent.mode)
    const started = marquee.start({
      pointerId: ctx.input.event.pointerId,
      capture: ctx.input.capture,
      start: instance.viewport.pointer({
        clientX: ctx.input.event.clientX,
        clientY: ctx.input.event.clientY
      }),
      match: intent.match,
      onChange: applyMatched,
      onEnd: (result) => {
        if (!result.moved) {
          return
        }

        applyMatched({
          nodeIds: result.nodeIds,
          edgeIds: result.edgeIds
        })
      }
    })

    if (started && moveEvent?.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const startMove = (
    ctx: SelectionPressContext,
    intent: Extract<SelectionPressIntent, { kind: 'move' }>,
    event: PointerEvent
  ) => {
    if (intent.select) {
      instance.commands.selection.replace(intent.select)
    }

    drag.start({
      pointerId: ctx.input.event.pointerId,
      capture: ctx.input.capture,
      start: ctx.input.point.world,
      frame: intent.frame,
      anchorId: intent.anchorId,
      nodeIds: intent.nodeIds,
      edgeIds: intent.edgeIds,
      event
    })
  }

  const runTapIntent = (
    intent: SelectionPressIntent,
    event: PointerEvent
  ) => {
    switch (intent.kind) {
      case 'clear':
        instance.commands.selection.clear()
        return
      case 'select':
        if (intent.match && !matchesTapTarget(instance, intent.match, event)) {
          return
        }

        instance.commands.selection.replace(intent.selection)
        return
      case 'edit':
        if (!matchesTapTarget(instance, intent.match, event)) {
          return
        }

        instance.commands.edit.start(intent.nodeId, intent.field)
        return
      case 'move':
      case 'marquee':
        return
    }
  }

  const runDragIntent = (
    ctx: SelectionPressContext,
    intent: SelectionPressIntent,
    event: PointerEvent
  ) => {
    if (intent.kind === 'move') {
      startMove(ctx, intent, event)
      return
    }

    if (intent.kind === 'marquee') {
      startMarquee(ctx, intent, event)
    }
  }

  const runHoldIntent = (
    ctx: SelectionPressContext,
    intent: SelectionPressIntent
  ) => {
    if (intent.kind === 'marquee') {
      startMarquee(ctx, intent)
    }
  }

  return {
    down: (input) => {
      const ctx = readSelectionPressContext(
        input,
        instance.read.selection.get()
      )
      const plan = instance.read.selection.press(ctx)
      if (!plan) {
        return false
      }

      const started = press.start({
        pointerId: ctx.input.event.pointerId,
        capture: ctx.input.capture,
        chrome: plan.chrome,
        start: {
          clientX: ctx.input.event.clientX,
          clientY: ctx.input.event.clientY
        },
        threshold: GestureTuning.dragMinDistance,
        holdDelay: plan.hold
          ? GestureTuning.holdDelay
          : undefined,
        onTap: plan.tap
          ? (event) => {
              runTapIntent(plan.tap!, event)
            }
          : undefined,
        onDragStart: plan.drag
          ? (event) => {
              runDragIntent(ctx, plan.drag!, event)
            }
          : undefined,
        onHold: plan.hold
          ? () => {
              runHoldIntent(ctx, plan.hold!)
            }
          : undefined
      })

      if (!started) {
        return false
      }

      stopPointerDown(ctx.input.event)
      return true
    },
    cancel
  }
}
