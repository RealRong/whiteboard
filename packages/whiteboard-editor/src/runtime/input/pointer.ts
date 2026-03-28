import { isPointInRect } from '@whiteboard/core/geometry'
import type {
  Point,
  Rect
} from '@whiteboard/core/types'
import {
  hasEdge,
  hasNode,
  type FrameScope
} from '../frame'
import type { InternalEditor } from '../instance/types'
import type { PointerPick } from '../pick'
import type { Tool } from '../tool'
import {
  readContextTarget,
  resolveContextTarget as resolveInputContextTarget,
  type ContextResolved,
  type ContextTarget
} from './target'
import {
  isDrawBrushKind,
  type DrawBrushKind,
  type DrawTool,
  type EdgeTool,
  type InsertTool,
  type SelectTool
} from '../tool'

export type CanvasDown = PointerPick & {
  container: HTMLDivElement
  event: PointerEvent
  capture: Element
  tool: Tool
}

export type CanvasFrameDown = CanvasDown & {
  frame: FrameScope
}

type PickOf<TKind extends CanvasFrameDown['pick']['kind']> = Extract<
  CanvasFrameDown['pick'],
  { kind: TKind }
>

type WithHandle<TPick extends { handle?: unknown }> = TPick & {
  handle: NonNullable<TPick['handle']>
}

type Down<TTool, TPick = CanvasFrameDown['pick']> = CanvasFrameDown & {
  tool: TTool
  pick: TPick
}

type SelectDown<TPick = CanvasFrameDown['pick']> = Down<SelectTool, TPick>

type TransformPick = WithHandle<
  Extract<CanvasFrameDown['pick'], {
    part: 'transform'
  }>
>

export type EdgeCreateDown = Down<EdgeTool>

export type EraserDown = Down<
  DrawTool & { kind: 'eraser' }
>

export type DrawDown = Down<
  DrawTool & { kind: DrawBrushKind }
>

export type InsertDown = Down<InsertTool>
export type TransformDown = SelectDown<TransformPick>
export type EdgeDown = SelectDown<PickOf<'edge'>>
export type MindmapDown = SelectDown<PickOf<'mindmap'>>
export type GestureDown = SelectDown

export type CanvasDownHandlers = {
  edgeCreate: (input: EdgeCreateDown) => boolean
  eraser: (input: EraserDown) => boolean
  draw: (input: DrawDown) => boolean
  insert: (input: InsertDown) => boolean
  transform: (input: TransformDown) => boolean
  edge: (input: EdgeDown) => boolean
  mindmap: (input: MindmapDown) => boolean
  gesture: (input: GestureDown) => boolean
}

export type ContextOpen = {
  target: ContextTarget
  leaveFrame: boolean
}

type CanvasFrameDeps = Pick<InternalEditor, 'commands' | 'read' | 'state'>

export const readCanvasDown = (
  instance: InternalEditor,
  container: HTMLDivElement,
  event: PointerEvent
): CanvasDown => {
  const input = instance.read.pick.from(event, container)

  return {
    ...input,
    container,
    event,
    capture: input.element ?? container,
    tool: instance.read.tool.get()
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
  instance: CanvasFrameDeps
) => {
  instance.commands.frame.exit()
  return instance.state.frame.get()
}

const normalizeCanvasFrame = (
  instance: CanvasFrameDeps,
  input: CanvasDown
): FrameScope => {
  const frame = instance.state.frame.get()
  if (!frame.id) {
    return frame
  }

  const frameNode = instance.read.node.item.get(frame.id)?.node
  if (!frameNode || instance.read.node.role(frameNode) !== 'frame') {
    return clearFrame(instance)
  }

  const frameRect = instance.read.index.node.get(frame.id)?.rect

  switch (input.pick.kind) {
    case 'background':
      return frameRect && isPointInRect(input.point.world, frameRect)
        ? frame
        : clearFrame(instance)
    case 'selection-box':
      return frame
    case 'node':
      if (input.pick.id === frame.id) {
        return frame
      }
      return hasNode(frame, input.pick.id)
        ? frame
        : clearFrame(instance)
    case 'mindmap':
      return hasNode(frame, input.pick.treeId)
        ? frame
        : clearFrame(instance)
    case 'edge': {
      const edge = instance.read.edge.item.get(input.pick.id)?.edge
      if (!edge) {
        return clearFrame(instance)
      }

      return hasEdge(frame, edge)
        ? frame
        : clearFrame(instance)
    }
  }
}

const isTransformPick = (
  input: CanvasFrameDown
): input is TransformDown => (
  (input.pick.kind === 'node' || input.pick.kind === 'selection-box')
  && input.pick.part === 'transform'
  && Boolean(input.pick.handle)
)

const isEdgePick = (
  input: CanvasFrameDown
): input is EdgeDown => input.pick.kind === 'edge'

const isMindmapPick = (
  input: CanvasFrameDown
): input is MindmapDown => input.pick.kind === 'mindmap'

const allowsCanvasContent = (
  input: CanvasFrameDown
) => (
  !input.editable
  && !input.ignoreInput
  && !input.ignoreSelection
)

const allowsDraw = (
  input: CanvasFrameDown
): input is DrawDown => (
  input.tool.type === 'draw'
  && isDrawBrushKind(input.tool.kind)
  && allowsCanvasContent(input)
)

const allowsErase = (
  input: CanvasFrameDown
): input is EraserDown => (
  input.tool.type === 'draw'
  && input.tool.kind === 'eraser'
  && !input.editable
  && !input.ignoreInput
)

const allowsEdgeCreate = (
  input: CanvasFrameDown
): input is EdgeCreateDown => (
  input.tool.type === 'edge'
  && (
    (
      input.pick.kind === 'node'
      && input.pick.part === 'connect'
      && Boolean(input.pick.side)
    )
    || allowsCanvasContent(input)
  )
)

const allowsInsert = (
  input: CanvasFrameDown
): input is InsertDown => (
  input.tool.type === 'insert'
  && allowsCanvasContent(input)
)

const isSelectTool = (
  input: CanvasFrameDown
): input is SelectDown => (
  input.tool.type === 'select'
)

export const dispatchCanvasDown = (
  instance: CanvasFrameDeps & Pick<InternalEditor, 'interaction'>,
  input: CanvasDown,
  handlers: CanvasDownHandlers
) => {
  const next: CanvasFrameDown = {
    ...input,
    frame: normalizeCanvasFrame(instance, input)
  }
  if (
    next.event.defaultPrevented
    || next.event.button !== 0
    || instance.interaction.busy.get()
  ) {
    return false
  }

  if (allowsEdgeCreate(next)) {
    return handlers.edgeCreate(next)
  }

  if (allowsErase(next)) {
    return handlers.eraser(next)
  }

  if (allowsDraw(next)) {
    return handlers.draw(next)
  }

  if (allowsInsert(next)) {
    return handlers.insert(next)
  }

  if (!isSelectTool(next)) {
    return false
  }

  if (isTransformPick(next)) {
    return handlers.transform(next)
  }

  if (isEdgePick(next)) {
    return handlers.edge(next)
  }

  if (isMindmapPick(next) && allowsCanvasContent(next)) {
    return handlers.mindmap(next)
  }

  return allowsCanvasContent(next)
    ? handlers.gesture(next)
    : false
}

export const readContextOpen = (
  instance: Pick<InternalEditor, 'read' | 'state'>,
  input: PointerPick
): ContextOpen | undefined => {
  const frame = instance.state.frame.get()
  const selection = instance.read.selection.get()
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
    const entry = instance.read.edge.item.get(target.edgeId)
    if (!entry) {
      return undefined
    }

    return {
      target,
      leaveFrame: !hasEdge(frame, entry.edge)
    }
  }

  const activeRect = frame.id
    ? instance.read.index.node.get(frame.id)?.rect
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
  instance: Pick<InternalEditor, 'read'>,
  target: ContextTarget
): ContextResolved | undefined => resolveInputContextTarget({
  getNode: (nodeId) => instance.read.node.item.get(nodeId)?.node,
  hasEdge: (edgeId) => Boolean(instance.read.edge.item.get(edgeId))
}, target)

export type {
  ContextResolved,
  ContextTarget
} from './target'
