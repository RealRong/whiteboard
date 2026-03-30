import type {
  EditorKeyboardInput,
  EditorPointerInput,
  EditorPointerSample,
  EditorWheelInput,
  EditorPick
} from '@whiteboard/editor'
import type { Point } from '@whiteboard/core/types'
import type { WhiteboardRuntime } from '../../types/runtime'
import type { PickRegistry } from './pickRegistry'
import {
  isContextMenuIgnoredTarget,
  isEditableTarget,
  isInputIgnoredTarget,
  isSelectionIgnoredTarget,
  readEditableFieldTarget
} from './domTargets'

type TargetEvent = Pick<MouseEvent | PointerEvent | WheelEvent, 'target' | 'clientX' | 'clientY'>

const BackgroundPick: EditorPick = {
  kind: 'background'
}

export type HostResolvedPoint = {
  pick: EditorPick
  point: {
    client: Point
    screen: Point
    world: Point
  }
  field?: ReturnType<typeof readEditableFieldTarget>
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
}

const resolveElement = (
  target: EventTarget | null,
  container: Element
) => (
  target instanceof Element && container.contains(target)
    ? target
    : null
)

const toPointerSample = (
  editor: WhiteboardRuntime,
  input: {
    clientX: number
    clientY: number
  }
): EditorPointerSample => {
  const point = editor.viewport.pointer(input)

  return {
    client: {
      x: input.clientX,
      y: input.clientY
    },
    screen: point.screen,
    world: point.world
  }
}

export const resolveHostPoint = ({
  editor,
  pick,
  container,
  event
}: {
  editor: WhiteboardRuntime
  pick: PickRegistry
  container: Element
  event: TargetEvent
}): HostResolvedPoint => {
  const element = resolveElement(event.target, container)
  const point = editor.viewport.pointer(event)

  return {
    pick: pick.element(element, container) ?? BackgroundPick,
    point: {
      client: {
        x: event.clientX,
        y: event.clientY
      },
      screen: point.screen,
      world: point.world
    },
    field: readEditableFieldTarget(element),
    editable: isEditableTarget(element),
    ignoreInput: isInputIgnoredTarget(element),
    ignoreSelection: isSelectionIgnoredTarget(element),
    ignoreContextMenu: isContextMenuIgnoredTarget(element)
  }
}

export const resolvePointerInput = ({
  editor,
  pick,
  container,
  event
}: {
  editor: WhiteboardRuntime
  pick: PickRegistry
  container: Element
  event: PointerEvent
}): EditorPointerInput => {
  const resolved = resolveHostPoint({
    editor,
    pick,
    container,
    event
  })

  const coalesced = typeof event.getCoalescedEvents === 'function'
    ? event.getCoalescedEvents()
    : []

  return {
    pointerId: event.pointerId,
    button: event.button,
    buttons: event.buttons,
    detail: event.detail,
    client: resolved.point.client,
    screen: resolved.point.screen,
    world: resolved.point.world,
    modifiers: {
      alt: event.altKey,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey
    },
    pick: resolved.pick,
    field: resolved.field,
    editable: resolved.editable,
    ignoreInput: resolved.ignoreInput,
    ignoreSelection: resolved.ignoreSelection,
    ignoreContextMenu: resolved.ignoreContextMenu,
    coalesced: coalesced.length > 0
      ? coalesced.map((entry) => toPointerSample(editor, entry))
      : undefined
  }
}

export const resolveWheelInput = ({
  editor,
  event
}: {
  editor: WhiteboardRuntime
  event: WheelEvent
}): EditorWheelInput => {
  const point = editor.viewport.pointer(event)

  return {
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    client: {
      x: event.clientX,
      y: event.clientY
    },
    screen: point.screen,
    world: point.world
  }
}

export const resolveKeyboardInput = (
  event: KeyboardEvent
): EditorKeyboardInput => ({
  key: event.key,
  code: event.code,
  repeat: event.repeat,
  modifiers: {
    alt: event.altKey,
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey
  },
  altKey: event.altKey,
  shiftKey: event.shiftKey,
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey
})
