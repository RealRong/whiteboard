import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  createPressRuntime,
  GestureTuning
} from '../../runtime/interaction'
import type { InteractionStart } from '../../runtime/input/pointer'
import type { EditorRuntime } from '../../runtime/editor/types'
import {
  toSelectionTarget,
  type SelectionTarget
} from '../../runtime/selection'
import {
  resolveSelectionPressPlan,
  type SelectionDragAction,
  type SelectionTapAction
} from '../../runtime/selection/press'
import type { MarqueeSession } from './marquee'
import { createNodeDragSession } from '../node/drag/session'
import type { NodeId } from '@whiteboard/core/types'

export type SelectionGesture = {
  down: (input: InteractionStart) => boolean
  cancel: () => void
}

type SelectionGestureDeps = Pick<
  EditorRuntime,
  'commands' | 'config' | 'interaction' | 'read' | 'viewport'
> & {
  internals: Pick<EditorRuntime['internals'], 'edge' | 'node' | 'pick' | 'snap'>
}

const EMPTY_SELECTION = toSelectionTarget({})

const buildSelectionWriter = (
  editor: SelectionGestureDeps,
  base: SelectionTarget,
  mode: SelectionMode
) => {
  return (matched: SelectionTarget) => {
    editor.commands.selection.replace({
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
  editor: SelectionGestureDeps,
  verifyNodeIds: readonly NodeId[] | undefined,
  event: PointerEvent
) => {
  if (!verifyNodeIds?.length) {
    return true
  }

  const targetPick = editor.internals.pick.element(
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

export const createSelectionGesture = (
  editor: SelectionGestureDeps,
  marquee: MarqueeSession
): SelectionGesture => {
  const press = createPressRuntime(editor.interaction)
  const drag = createNodeDragSession(editor)

  const cancel = () => {
    press.cancel()
    drag.cancel()
    marquee.cancel()
  }

  const startMarquee = (
    start: InteractionStart,
    action: Extract<SelectionDragAction, { kind: 'marquee' }>,
    moveEvent?: PointerEvent
  ) => {
    const applyMatched = buildSelectionWriter(editor, action.base, action.mode)
    const started = marquee.start({
      pointerId: start.event.pointerId,
      capture: start.capture,
      start: editor.viewport.pointer({
        clientX: start.event.clientX,
        clientY: start.event.clientY
      }),
      match: action.match,
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

  const startContainMarquee = (
    start: InteractionStart
  ) => {
    editor.commands.selection.clear()

    startMarquee(start, {
      kind: 'marquee',
      match: 'contain',
      mode: 'replace',
      base: EMPTY_SELECTION
    })
  }

  const startMove = (
    start: InteractionStart,
    action: Extract<SelectionDragAction, { kind: 'move' }>,
    event: PointerEvent
  ) => {
    if (action.nextSelection) {
      editor.commands.selection.replace(action.nextSelection)
    }

    drag.start({
      pointerId: start.event.pointerId,
      capture: start.capture,
      start: start.point.world,
      frame: action.frame,
      anchorId: action.anchorId,
      nodeIds: action.target.nodeIds,
      edgeIds: action.target.edgeIds,
      event
    })
  }

  const runTapAction = (
    action: SelectionTapAction,
    event: PointerEvent
  ) => {
    switch (action.kind) {
      case 'clear':
        editor.commands.selection.clear()
        return
      case 'select':
        if (!matchesTapTarget(editor, action.verifyNodeIds, event)) {
          return
        }

        editor.commands.selection.replace(action.target)
        return
      case 'edit':
        if (!matchesTapTarget(editor, action.verifyNodeIds, event)) {
          return
        }

        editor.commands.edit.start(action.nodeId, action.field)
        return
    }
  }

  const runDragAction = (
    start: InteractionStart,
    action: SelectionDragAction,
    event: PointerEvent
  ) => {
    if (action.kind === 'move') {
      startMove(start, action, event)
      return
    }

    if (action.kind === 'marquee') {
      startMarquee(start, action, event)
    }
  }

  return {
    down: (input) => {
      const plan = resolveSelectionPressPlan({
        getNode: (nodeId) => editor.read.node.item.get(nodeId)?.node,
        getOwnerId: editor.read.node.owner,
        getNodeFrame: editor.read.node.frame,
        getNodeRole: (node) => editor.read.node.role(node)
      }, {
        start: input,
        snapshot: editor.read.selection.get()
      })
      if (!plan) {
        return false
      }

      const started = press.start({
        pointerId: input.event.pointerId,
        capture: input.capture,
        chrome: plan.chrome,
        start: {
          clientX: input.event.clientX,
          clientY: input.event.clientY
        },
        threshold: GestureTuning.dragMinDistance,
        holdDelay: plan.allowHold
          ? GestureTuning.holdDelay
          : undefined,
        onTap: plan.tap
          ? (event) => {
              runTapAction(plan.tap!, event)
            }
          : undefined,
        onDragStart: plan.drag
          ? (event) => {
              runDragAction(input, plan.drag!, event)
            }
          : undefined,
        onHold: plan.allowHold
          ? () => {
              startContainMarquee(input)
            }
          : undefined
      })

      if (!started) {
        return false
      }

      stopPointerDown(input.event)
      return true
    },
    cancel
  }
}
