import { isPointInRect } from '@whiteboard/core/geometry'
import {
  hasEdge,
  hasNode,
  type FrameScope
} from '../frame'
import type { Editor, EditorRuntime } from '../editor/types'
import type { PointerPick } from '../pick'
import type { Tool } from '../tool'
import {
  readContextTarget,
  resolveContextTarget as resolveInputContextTarget,
  type ContextResolved,
  type ContextTarget
} from './target'
import {
  isDrawInteractionStart,
  isEraseInteractionStart
} from '../../features/draw/interactionStart'
import {
  isEdgeCreateInteractionStart,
  isEdgeInteractionStart
} from '../../features/edge/interactionStart'
import {
  isMindmapInteractionStart
} from '../../features/mindmap/interactionStart'
import {
  isTransformInteractionStart
} from '../../features/node/session/transformStart'
import {
  isSelectionInteractionStart
} from '../../features/selection/interactionStart'
import {
  isInsertInteractionStart
} from '../../features/toolbox/interactionStart'

export type PointerStart = PointerPick & {
  container: HTMLDivElement
  event: PointerEvent
  capture: Element
  tool: Tool
  frame: FrameScope
}

export type PointerActionKind =
  | 'edge-create'
  | 'erase'
  | 'draw'
  | 'insert'
  | 'transform'
  | 'edge'
  | 'mindmap'
  | 'selection'

export type PointerAction = {
  kind: PointerActionKind
  start: PointerStart
}

export type ContextOpen = {
  target: ContextTarget
  leaveFrame: boolean
}

type PointerActionResolverDeps = Pick<EditorRuntime, 'commands' | 'read' | 'state' | 'host'>

type PointerActionRunnerDeps = Pick<EditorRuntime, 'commands' | 'read' | 'host'>

type PointerActionRoute = {
  kind: PointerActionKind
  match: (start: PointerStart) => boolean
}

const DRAW_POINTER_ACTION_ROUTES: readonly PointerActionRoute[] = [
  {
    kind: 'erase',
    match: isEraseInteractionStart
  },
  {
    kind: 'draw',
    match: isDrawInteractionStart
  }
]

const EDGE_POINTER_ACTION_ROUTES: readonly PointerActionRoute[] = [
  {
    kind: 'edge-create',
    match: isEdgeCreateInteractionStart
  }
]

const INSERT_POINTER_ACTION_ROUTES: readonly PointerActionRoute[] = [
  {
    kind: 'insert',
    match: isInsertInteractionStart
  }
]

const SELECT_POINTER_ACTION_ROUTES: readonly PointerActionRoute[] = [
  {
    kind: 'transform',
    match: isTransformInteractionStart
  },
  {
    kind: 'edge',
    match: isEdgeInteractionStart
  },
  {
    kind: 'mindmap',
    match: isMindmapInteractionStart
  },
  {
    kind: 'selection',
    match: isSelectionInteractionStart
  }
]

const POINTER_ACTION_ROUTES_BY_TOOL_TYPE: Partial<Record<Tool['type'], readonly PointerActionRoute[]>> = {
  draw: DRAW_POINTER_ACTION_ROUTES,
  edge: EDGE_POINTER_ACTION_ROUTES,
  insert: INSERT_POINTER_ACTION_ROUTES,
  select: SELECT_POINTER_ACTION_ROUTES
}

export const readPointerStart = (
  editor: Pick<Editor, 'read' | 'state'>,
  container: HTMLDivElement,
  event: PointerEvent
): PointerStart => {
  const input = editor.read.pick.from(event, container)

  return {
    ...input,
    container,
    event,
    capture: input.element ?? container,
    tool: editor.read.tool.get(),
    frame: editor.state.frame.get()
  }
}

export const readPointerSamples = (
  event: PointerEvent
) => {
  if (typeof event.getCoalescedEvents !== 'function') {
    return [event]
  }

  const samples = event.getCoalescedEvents()
  return samples.length > 0 ? samples : [event]
}

const clearFrame = (
  editor: Pick<Editor, 'commands' | 'state'>
) => {
  editor.commands.frame.exit()
  return editor.state.frame.get()
}

const normalizeInteractionFrame = (
  editor: Pick<Editor, 'commands' | 'read' | 'state'>,
  start: PointerStart
): FrameScope => {
  const frame = start.frame
  if (!frame.id) {
    return frame
  }

  const frameNode = editor.read.node.item.get(frame.id)?.node
  if (!frameNode || editor.read.node.role(frameNode) !== 'frame') {
    return clearFrame(editor)
  }

  const frameRect = editor.read.index.node.get(frame.id)?.rect

  switch (start.pick.kind) {
    case 'background':
      return frameRect && isPointInRect(start.point.world, frameRect)
        ? frame
        : clearFrame(editor)
    case 'selection-box':
      return frame
    case 'node':
      if (start.pick.id === frame.id) {
        return frame
      }
      return hasNode(frame, start.pick.id)
        ? frame
        : clearFrame(editor)
    case 'mindmap':
      return hasNode(frame, start.pick.treeId)
        ? frame
        : clearFrame(editor)
    case 'edge': {
      const edge = editor.read.edge.item.get(start.pick.id)?.edge
      if (!edge) {
        return clearFrame(editor)
      }

      return hasEdge(frame, edge)
        ? frame
        : clearFrame(editor)
    }
  }
}

const withNormalizedFrame = (
  editor: Pick<Editor, 'commands' | 'read' | 'state'>,
  start: PointerStart
): PointerStart => ({
  ...start,
  frame: normalizeInteractionFrame(editor, start)
})

const resolveRoutedPointerAction = (
  start: PointerStart,
  routes: readonly PointerActionRoute[]
): PointerAction | undefined => {
  for (const route of routes) {
    if (route.match(start)) {
      return {
        kind: route.kind,
        start
      }
    }
  }

  return undefined
}

export const resolvePointerAction = (
  editor: PointerActionResolverDeps,
  input: PointerStart
): PointerAction | undefined => {
  const start = withNormalizedFrame(editor, input)

  if (
    start.event.defaultPrevented
    || start.event.button !== 0
    || editor.host.interaction.busy.get()
  ) {
    return undefined
  }

  return resolveRoutedPointerAction(
    start,
    POINTER_ACTION_ROUTES_BY_TOOL_TYPE[start.tool.type] ?? []
  )
}

const runInsertPointerAction = (
  editor: Pick<Editor, 'commands' | 'read'>,
  input: PointerStart
) => {
  if (input.tool.type !== 'insert') {
    return false
  }

  const presetKey = input.tool.preset
  if (!presetKey || input.pick.kind !== 'background') {
    return false
  }

  const frameTargetId = input.frame.id ?? editor.read.node.frameAt(input.point.world)
  const result = editor.commands.insert.preset(presetKey, {
    at: input.point.world,
    ownerId: input.frame.id ?? frameTargetId
  })
  if (!result) {
    return false
  }

  editor.commands.tool.select()
  input.event.preventDefault()
  input.event.stopPropagation()
  return true
}

const POINTER_ACTION_RUNNERS: Record<
  PointerActionKind,
  (editor: PointerActionRunnerDeps, start: PointerStart) => boolean
> = {
  'edge-create': (editor, start) => editor.host.edge.connect.create(start),
  erase: (editor, start) => editor.host.draw.down(start),
  draw: (editor, start) => editor.host.draw.down(start),
  insert: (editor, start) => runInsertPointerAction(editor, start),
  transform: (editor, start) => editor.host.node.transform.down(start),
  edge: (editor, start) => editor.host.edge.input.down(start),
  mindmap: (editor, start) => editor.host.mindmap.controller.down(start),
  selection: (editor, start) => editor.host.selection.gesture.down(start)
}

export const runPointerAction = (
  editor: PointerActionRunnerDeps,
  action: PointerAction | undefined
) => {
  if (!action) {
    return false
  }

  return POINTER_ACTION_RUNNERS[action.kind](editor, action.start)
}

export const handlePointerDown = (
  editor: PointerActionResolverDeps & PointerActionRunnerDeps,
  container: HTMLDivElement,
  event: PointerEvent
) => runPointerAction(
  editor,
  resolvePointerAction(
    editor,
    readPointerStart(editor, container, event)
  )
)

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
