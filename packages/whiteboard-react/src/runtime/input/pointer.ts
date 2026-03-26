import { isPointInRect } from '@whiteboard/core/geometry'
import type {
  EdgeId,
  Node as WhiteboardNode,
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import {
  hasEdge,
  hasNode,
  type FrameScope
} from '../frame'
import type { InternalInstance } from '../instance'
import type { PointerPick } from '../pick'
import type { Tool } from '../tool'
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

export type CanvasDownRoute =
  | { kind: 'edge-create'; input: EdgeCreateDown }
  | { kind: 'eraser'; input: EraserDown }
  | { kind: 'draw'; input: DrawDown }
  | { kind: 'insert'; input: InsertDown }
  | { kind: 'transform'; input: TransformDown }
  | { kind: 'edge'; input: EdgeDown }
  | { kind: 'mindmap'; input: MindmapDown }
  | { kind: 'gesture'; input: GestureDown }

export type ContextTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; nodeId: NodeId; world: Point }
  | { kind: 'nodes'; nodeIds: readonly NodeId[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

export type ContextResolved =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; node: WhiteboardNode; world: Point }
  | { kind: 'nodes'; nodes: readonly WhiteboardNode[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

export type ContextOpen = {
  target: ContextTarget
  leaveFrame: boolean
}

export const readCanvasDown = (
  instance: InternalInstance,
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
  instance: InternalInstance
) => {
  instance.commands.frame.exit()
  return instance.state.frame.get()
}

export const normalizeCanvasFrame = (
  instance: InternalInstance,
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

export const withCanvasFrame = (
  instance: InternalInstance,
  input: CanvasDown
): CanvasFrameDown => ({
  ...input,
  frame: normalizeCanvasFrame(instance, input)
})

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

export const readCanvasDownRoute = (
  input: CanvasFrameDown,
  busy: boolean
): CanvasDownRoute | undefined => {
  if (input.event.defaultPrevented || input.event.button !== 0 || busy) {
    return undefined
  }

  if (allowsEdgeCreate(input)) {
    return {
      kind: 'edge-create',
      input
    }
  }

  if (allowsErase(input)) {
    return {
      kind: 'eraser',
      input
    }
  }

  if (allowsDraw(input)) {
    return {
      kind: 'draw',
      input
    }
  }

  if (allowsInsert(input)) {
    return {
      kind: 'insert',
      input
    }
  }

  if (!isSelectTool(input)) {
    return undefined
  }

  if (isTransformPick(input)) {
    return {
      kind: 'transform',
      input
    }
  }

  if (isEdgePick(input)) {
    return {
      kind: 'edge',
      input
    }
  }

  if (isMindmapPick(input) && allowsCanvasContent(input)) {
    return {
      kind: 'mindmap',
      input
    }
  }

  return allowsCanvasContent(input)
    ? {
        kind: 'gesture',
        input
      }
    : undefined
}

const readNodeTarget = ({
  selectionNodeSet,
  selectionNodeIds,
  selectionCount,
  nodeId,
  world
}: {
  selectionNodeSet: ReadonlySet<NodeId>
  selectionNodeIds: readonly NodeId[]
  selectionCount: number
  nodeId: NodeId
  world: Point
}): ContextTarget => (
  selectionNodeSet.has(nodeId) && selectionCount > 1
    ? {
        kind: 'nodes',
        nodeIds: selectionNodeIds,
        world
      }
    : {
        kind: 'node',
        nodeId,
        world
      }
)

export const readContextOpen = (
  instance: Pick<InternalInstance, 'read' | 'state'>,
  input: PointerPick
): ContextOpen | undefined => {
  const frame = instance.state.frame.get()
  const selection = instance.read.selection.get()
  const world = input.point.world
  const pick = input.pick

  if (pick.kind === 'selection-box' && selection.items.count > 1) {
    return {
      target: {
        kind: 'nodes',
        nodeIds: selection.target.nodeIds,
        world
      },
      leaveFrame: false
    }
  }

  if (pick.kind === 'node') {
    return {
      target: readNodeTarget({
        selectionNodeSet: selection.target.nodeSet,
        selectionNodeIds: selection.target.nodeIds,
        selectionCount: selection.items.count,
        nodeId: pick.id,
        world
      }),
      leaveFrame: !hasNode(frame, pick.id)
    }
  }

  if (pick.kind === 'edge') {
    const entry = instance.read.edge.item.get(pick.id)
    if (!entry) {
      return undefined
    }

    return {
      target: {
        kind: 'edge',
        edgeId: pick.id,
        world
      },
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
  instance: Pick<InternalInstance, 'read'>,
  target: ContextTarget
): ContextResolved | undefined => {
  switch (target.kind) {
    case 'canvas':
      return target
    case 'node': {
      const entry = instance.read.node.item.get(target.nodeId)
      if (!entry) {
        return undefined
      }

      return {
        kind: 'node',
        node: entry.node,
        world: target.world
      }
    }
    case 'nodes': {
      const nodes = target.nodeIds
        .map((nodeId) => instance.read.node.item.get(nodeId)?.node)
        .filter((node): node is NonNullable<typeof node> => Boolean(node))

      if (!nodes.length) {
        return undefined
      }

      return {
        kind: 'nodes',
        nodes,
        world: target.world
      }
    }
    case 'edge': {
      const entry = instance.read.edge.item.get(target.edgeId)
      if (!entry) {
        return undefined
      }

      return {
        kind: 'edge',
        edgeId: entry.edge.id,
        world: target.world
      }
    }
  }
}
