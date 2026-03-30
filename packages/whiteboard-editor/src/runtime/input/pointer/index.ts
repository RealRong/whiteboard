import { isPointInRect } from '@whiteboard/core/geometry'
import {
  hasEdge,
  hasNode,
  type FrameScope
} from '../frame'
import type { Editor } from '../editor/types'
import type { PointerPick } from '../pick'
import type { Tool } from '../tool'
import {
  readContextTarget,
  resolveContextTarget as resolveInputContextTarget,
  type ContextResolved,
  type ContextTarget
} from './target'

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

export type ContextOpen = {
  target: ContextTarget
  leaveFrame: boolean
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

const ROOT_FRAME: FrameScope = {
  ids: []
}

const resolveInteractionFrame = (
  editor: Pick<Editor, 'read'>,
  start: Pick<PointerDown, 'frame' | 'pick' | 'point'>
): {
  frame: FrameScope
  exit: boolean
} => {
  const frame = start.frame
  if (!frame.id) {
    return {
      frame,
      exit: false
    }
  }

  const frameNode = editor.read.node.item.get(frame.id)?.node
  if (!frameNode || editor.read.node.role(frameNode) !== 'frame') {
    return {
      frame: ROOT_FRAME,
      exit: true
    }
  }

  const frameRect = editor.read.index.node.get(frame.id)?.rect

  switch (start.pick.kind) {
    case 'background':
      return frameRect && isPointInRect(start.point.world, frameRect)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME,
            exit: true
          }
    case 'selection-box':
      return {
        frame,
        exit: false
      }
    case 'node':
      if (start.pick.id === frame.id) {
        return {
          frame,
          exit: false
        }
      }
      return hasNode(frame, start.pick.id)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME,
            exit: true
          }
    case 'mindmap':
      return hasNode(frame, start.pick.treeId)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME,
            exit: true
          }
    case 'edge': {
      const edge = editor.read.edge.item.get(start.pick.id)?.edge
      if (!edge) {
        return {
          frame: ROOT_FRAME,
          exit: true
        }
      }

      return hasEdge(frame, edge)
        ? {
            frame,
            exit: false
          }
        : {
            frame: ROOT_FRAME,
            exit: true
          }
    }
  }
}

export const resolvePointerDown = (
  editor: Pick<Editor, 'read' | 'state'>,
  container: HTMLDivElement,
  event: PointerEvent
): PointerDown => {
  const start = readPointerDown(editor, container, event)
  const frame = resolveInteractionFrame(editor, start)

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
  const frame = resolveInteractionFrame(editor, {
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

export const readContextOpen = (
  editor: Pick<Editor, 'read' | 'state'>,
  input: PointerPick
): ContextOpen | undefined => {
  const frame = editor.state.frame.get()
  const selection = editor.read.selection.get()
  const world = input.point.world
  const pick = input.pick
  const target = readContextTarget({
    pick,
    world,
    selectionNodeIds: selection.target.nodeIds,
    selectionNodeSet: selection.target.nodeSet,
    selectionCount: selection.items.count
  })

  if (target.kind === 'nodes') {
    return {
      target,
      leaveFrame: pick.kind === 'selection-box'
        ? false
        : pick.kind === 'node'
          ? !hasNode(frame, pick.id)
          : false
    }
  }

  if (target.kind === 'node') {
    return {
      target,
      leaveFrame: !hasNode(frame, target.nodeId)
    }
  }

  if (target.kind === 'edge') {
    const entry = editor.read.edge.item.get(target.edgeId)
    if (!entry) {
      return undefined
    }

    return {
      target,
      leaveFrame: !hasEdge(frame, entry.edge)
    }
  }

  const activeRect = frame.id
    ? editor.read.index.node.get(frame.id)?.rect
    : undefined
  const insideActiveFrame = Boolean(activeRect && isPointInRect(world, activeRect))

  return {
    target: {
      kind: 'canvas',
      world
    },
    leaveFrame: Boolean(frame.id && !insideActiveFrame)
  }
}

export const resolveContextTarget = (
  editor: Pick<Editor, 'read'>,
  target: ContextTarget
): ContextResolved | undefined => resolveInputContextTarget({
  getNode: (nodeId) => editor.read.node.item.get(nodeId)?.node,
  hasEdge: (edgeId) => Boolean(editor.read.edge.item.get(edgeId))
}, target)

export type {
  ContextResolved,
  ContextTarget
} from './target'
