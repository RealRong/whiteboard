import type { FrameScope } from '@whiteboard/core/document'
import type { Editor } from '../../../types/public/editor'
import type { PointerPick } from '../../pick'
import type { Tool } from '../../tool'
import { resolvePointerFrameGate } from './gate'

export type PointerDown = PointerPick & {
  phase: 'pointer/down'
  container: HTMLDivElement
  event: PointerEvent
  capture: Element
  tool: Tool
  frame: FrameScope
  frameExit: boolean
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
}

export type PointerMove = PointerPick & {
  phase: 'pointer/move'
  container: HTMLDivElement
  event: PointerEvent
  capture: Element
  tool: Tool
  frame: FrameScope
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
}

export type PointerUp = PointerPick & {
  phase: 'pointer/up'
  container: HTMLDivElement
  event: PointerEvent
  capture: Element
  tool: Tool
  frame: FrameScope
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
}

export type ResolvedWheelInput = {
  deltaX: number
  deltaY: number
  ctrlKey: boolean
  metaKey: boolean
  point: {
    client: {
      x: number
      y: number
    }
    screen: {
      x: number
      y: number
    }
    world: {
      x: number
      y: number
    }
  }
}

const readPointerDown = (
  editor: Pick<Editor, 'read' | 'state'>,
  container: HTMLDivElement,
  event: PointerEvent
): Omit<PointerDown, 'frameExit'> => {
  const input = editor.read.pick.from(event, container)

  return {
    ...input,
    phase: 'pointer/down',
    container,
    event,
    capture: input.element ?? container,
    tool: editor.read.tool.get(),
    frame: editor.state.frame.get(),
    modifiers: {
      alt: event.altKey,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey
    }
  }
}

export const resolvePointerDown = (
  editor: Pick<Editor, 'read' | 'state'>,
  container: HTMLDivElement,
  event: PointerEvent
): PointerDown => {
  const start = readPointerDown(editor, container, event)
  const frame = resolvePointerFrameGate(editor, start)

  return {
    ...start,
    frame: frame.frame,
    frameExit: frame.exit
  }
}

const readPointerEvent = (
  editor: Pick<Editor, 'read' | 'state'>,
  container: HTMLDivElement,
  event: PointerEvent,
  phase: PointerMove['phase'] | PointerUp['phase']
): PointerMove | PointerUp => {
  const input = editor.read.pick.from(event, container)
  const frame = resolvePointerFrameGate(editor, {
    pick: input.pick,
    point: input.point,
    frame: editor.state.frame.get()
  })

  return {
    ...input,
    phase,
    container,
    event,
    capture: input.element ?? container,
    tool: editor.read.tool.get(),
    frame: frame.frame,
    modifiers: {
      alt: event.altKey,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey
    }
  }
}

export const resolvePointerMove = (
  editor: Pick<Editor, 'read' | 'state'>,
  container: HTMLDivElement,
  event: PointerEvent
): PointerMove => readPointerEvent(
  editor,
  container,
  event,
  'pointer/move'
) as PointerMove

export const resolvePointerUp = (
  editor: Pick<Editor, 'read' | 'state'>,
  container: HTMLDivElement,
  event: PointerEvent
): PointerUp => readPointerEvent(
  editor,
  container,
  event,
  'pointer/up'
) as PointerUp

export const resolveWheelInput = (
  editor: Pick<Editor, 'viewport'>,
  event: {
    clientX: number
    clientY: number
    deltaX: number
    deltaY: number
    ctrlKey: boolean
    metaKey: boolean
  }
): ResolvedWheelInput => {
  const point = editor.viewport.pointer(event)

  return {
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    point: {
      client: {
        x: event.clientX,
        y: event.clientY
      },
      screen: point.screen,
      world: point.world
    }
  }
}
