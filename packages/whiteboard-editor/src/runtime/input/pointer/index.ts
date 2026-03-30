import type { FrameScope } from '@whiteboard/core/document'
import type {
  Editor,
  EditorPointerInput,
  EditorPointerSample,
  EditorWheelInput
} from '../../../types/editor'
import type { PointerPick } from '../../../types/runtime/pick'
import type { Tool } from '../../tool'
import { resolvePointerFrameGate } from './gate'

type PointerBase = PointerPick & {
  pointerId: number
  button: number
  buttons: number
  detail: number
  tool: Tool
  frame: FrameScope
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  samples: readonly EditorPointerSample[]
}

export type PointerDown = PointerBase & {
  phase: 'pointer/down'
  frameExit: boolean
}

export type PointerMove = PointerBase & {
  phase: 'pointer/move'
}

export type PointerUp = PointerBase & {
  phase: 'pointer/up'
}

export type ResolvedWheelInput = EditorWheelInput

const BackgroundPick = {
  kind: 'background'
} as const

const toSamples = (
  input: EditorPointerInput
): readonly EditorPointerSample[] => (
  input.coalesced && input.coalesced.length > 0
    ? input.coalesced
    : [{
        client: input.client,
        screen: input.screen,
        world: input.world
      }]
)

const readPointerPick = (
  input: EditorPointerInput
): PointerPick => ({
  pick: input.pick ?? BackgroundPick,
  point: {
    client: input.client,
    screen: input.screen,
    world: input.world
  },
  field: input.field,
  editable: input.editable,
  ignoreInput: input.ignoreInput,
  ignoreSelection: input.ignoreSelection,
  ignoreContextMenu: input.ignoreContextMenu
})

const readResolvedPointer = (
  editor: Pick<Editor, 'read' | 'state'>,
  input: EditorPointerInput,
  phase: PointerDown['phase'] | PointerMove['phase'] | PointerUp['phase']
) => {
  const pick = readPointerPick(input)
  const frame = resolvePointerFrameGate(editor, {
    pick: pick.pick,
    point: pick.point,
    frame: editor.state.frame.get()
  })

  return {
    ...pick,
    phase,
    pointerId: input.pointerId,
    button: input.button,
    buttons: input.buttons,
    detail: input.detail,
    tool: editor.read.tool.get(),
    frame: frame.frame,
    modifiers: input.modifiers,
    altKey: input.modifiers.alt,
    shiftKey: input.modifiers.shift,
    ctrlKey: input.modifiers.ctrl,
    metaKey: input.modifiers.meta,
    samples: toSamples(input)
  }
}

export const resolvePointerDown = (
  editor: Pick<Editor, 'read' | 'state'>,
  input: EditorPointerInput
): PointerDown => {
  const resolved = readResolvedPointer(editor, input, 'pointer/down')

  return {
    ...resolved,
    phase: 'pointer/down',
    frameExit: resolved.frame.id !== editor.state.frame.get().id
  }
}

export const resolvePointerMove = (
  editor: Pick<Editor, 'read' | 'state'>,
  input: EditorPointerInput
): PointerMove => readResolvedPointer(
  editor,
  input,
  'pointer/move'
) as PointerMove

export const resolvePointerUp = (
  editor: Pick<Editor, 'read' | 'state'>,
  input: EditorPointerInput
): PointerUp => readResolvedPointer(
  editor,
  input,
  'pointer/up'
) as PointerUp

export const resolveWheelInput = (
  _editor: Pick<Editor, 'viewport'>,
  input: EditorWheelInput
): ResolvedWheelInput => input
