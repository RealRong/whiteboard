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

export type InteractionStart = PointerPick & {
  container: HTMLDivElement
  event: PointerEvent
  capture: Element
  tool: Tool
  frame: FrameScope
}

export type InteractionDecision =
  | { kind: 'reject' }
  | { kind: 'edge-create'; start: InteractionStart }
  | { kind: 'erase'; start: InteractionStart }
  | { kind: 'draw'; start: InteractionStart }
  | { kind: 'insert'; start: InteractionStart }
  | { kind: 'transform'; start: InteractionStart }
  | { kind: 'edge'; start: InteractionStart }
  | { kind: 'mindmap'; start: InteractionStart }
  | { kind: 'selection'; start: InteractionStart }

export type ContextOpen = {
  target: ContextTarget
  leaveFrame: boolean
}

type InteractionDecisionDeps = Pick<Editor, 'commands' | 'read' | 'state'> & {
  host: Pick<Editor['host'], 'interaction'>
}

type InteractionRunnerDeps = Pick<Editor, 'commands' | 'read'> & {
  host: Pick<Editor['host'], 'draw' | 'edge' | 'mindmap' | 'node' | 'selection'>
}

type RoutedDecisionKind = Exclude<InteractionDecision['kind'], 'reject'>

type InteractionRoute = {
  kind: RoutedDecisionKind
  match: (start: InteractionStart) => boolean
}

const DRAW_INTERACTION_ROUTES: readonly InteractionRoute[] = [
  {
    kind: 'erase',
    match: isEraseInteractionStart
  },
  {
    kind: 'draw',
    match: isDrawInteractionStart
  }
]

const EDGE_INTERACTION_ROUTES: readonly InteractionRoute[] = [
  {
    kind: 'edge-create',
    match: isEdgeCreateInteractionStart
  }
]

const INSERT_INTERACTION_ROUTES: readonly InteractionRoute[] = [
  {
    kind: 'insert',
    match: isInsertInteractionStart
  }
]

const SELECT_INTERACTION_ROUTES: readonly InteractionRoute[] = [
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

const INTERACTION_ROUTES_BY_TOOL_TYPE: Partial<Record<Tool['type'], readonly InteractionRoute[]>> = {
  draw: DRAW_INTERACTION_ROUTES,
  edge: EDGE_INTERACTION_ROUTES,
  insert: INSERT_INTERACTION_ROUTES,
  select: SELECT_INTERACTION_ROUTES
}

export const readInteractionStart = (
  editor: Pick<Editor, 'read' | 'state'>,
  container: HTMLDivElement,
  event: PointerEvent
): InteractionStart => {
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
  start: InteractionStart
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
  start: InteractionStart
): InteractionStart => ({
  ...start,
  frame: normalizeInteractionFrame(editor, start)
})

const resolveRoutedInteractionDecision = (
  start: InteractionStart,
  routes: readonly InteractionRoute[]
): InteractionDecision => {
  for (const route of routes) {
    if (route.match(start)) {
      return {
        kind: route.kind,
        start
      }
    }
  }

  return {
    kind: 'reject'
  }
}

export const resolveInteractionDecision = (
  editor: InteractionDecisionDeps,
  input: InteractionStart
): InteractionDecision => {
  const start = withNormalizedFrame(editor, input)

  if (
    start.event.defaultPrevented
    || start.event.button !== 0
    || editor.host.interaction.busy.get()
  ) {
    return { kind: 'reject' }
  }

  return resolveRoutedInteractionDecision(
    start,
    INTERACTION_ROUTES_BY_TOOL_TYPE[start.tool.type] ?? []
  )
}

const runInsertInteraction = (
  editor: Pick<Editor, 'commands' | 'read'>,
  input: InteractionStart
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

export const runInteractionDecision = (
  editor: InteractionRunnerDeps,
  decision: InteractionDecision
) => {
  switch (decision.kind) {
    case 'edge-create':
      return editor.host.edge.connect.create(decision.start)
    case 'erase':
      return editor.host.draw.down(decision.start)
    case 'draw':
      return editor.host.draw.down(decision.start)
    case 'insert':
      return runInsertInteraction(editor, decision.start)
    case 'transform':
      return editor.host.node.transform.down(decision.start)
    case 'edge':
      return editor.host.edge.input.down(decision.start)
    case 'mindmap':
      return editor.host.mindmap.controller.down(decision.start)
    case 'selection':
      return editor.host.selection.gesture.down(decision.start)
    case 'reject':
      return false
  }
}

export const handlePointerDown = (
  editor: InteractionDecisionDeps & InteractionRunnerDeps,
  container: HTMLDivElement,
  event: PointerEvent
) => runInteractionDecision(
  editor,
  resolveInteractionDecision(
    editor,
    readInteractionStart(editor, container, event)
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
