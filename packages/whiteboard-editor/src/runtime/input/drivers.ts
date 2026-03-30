import { isDrawBrushKind } from '../tool'
import type { Editor } from '../../types/public/editor'
import type { InteractionDriver } from '../interaction'
import type { PointerDown } from './pointer'
import type { DrawInputRuntime } from '../../features/draw/input'
import type { EdgeConnectInteraction } from '../../features/edge/connect/interaction'
import type { EdgeInputRuntime } from '../../features/edge/input'
import type { MindmapDragInteraction } from '../../features/mindmap/drag/interaction'
import type { NodeTransformInteraction } from '../../features/node/transform/interaction'
import type { SelectionPressRuntime } from '../../features/selection/gesture'

type InputDriverDeps = Pick<Editor, 'commands' | 'read' | 'state'> & {
  draw: Pick<DrawInputRuntime, 'startStroke' | 'startErase' | 'cancel'>
  selection: Pick<SelectionPressRuntime, 'start' | 'cancel'>
  node: {
    transform: Pick<NodeTransformInteraction, 'start' | 'cancel'>
  }
  edge: {
    connect: Pick<EdgeConnectInteraction, 'startCreate' | 'startReconnect' | 'cancel'>
    edit: Pick<EdgeInputRuntime, 'startRoute' | 'startBody' | 'cancel'>
  }
  mindmap: {
    drag: Pick<MindmapDragInteraction, 'start' | 'cancel'>
  }
}

const allowsCanvasContent = (
  start: PointerDown
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const createInsertPresetDriver = (
  editor: Pick<Editor, 'commands' | 'read'>
): InteractionDriver<PointerDown> => ({
  kind: 'insert.preset',
  priority: 700,
  resolve: (start) => (
    start.tool.type === 'insert'
    && start.pick.kind === 'background'
    && Boolean(start.tool.preset)
    && allowsCanvasContent(start)
      ? start
      : null
  ),
  start: (start) => {
    if (start.tool.type !== 'insert' || start.pick.kind !== 'background') {
      return false
    }

    const presetKey = start.tool.preset
    if (!presetKey) {
      return false
    }

    const frameTargetId = start.frame.id ?? editor.read.node.frameAt(start.point.world)
    const result = editor.commands.insert.preset(presetKey, {
      at: start.point.world,
      ownerId: start.frame.id ?? frameTargetId
    })
    if (!result) {
      return false
    }

    editor.commands.tool.select()
    start.event.preventDefault()
    start.event.stopPropagation()
    return true
  }
})

export const createDrawStrokeDriver = (
  draw: Pick<DrawInputRuntime, 'startStroke' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'draw.stroke',
  priority: 600,
  resolve: (start) => (
    start.tool.type === 'draw'
    && isDrawBrushKind(start.tool.kind)
    && start.pick.kind === 'background'
    && allowsCanvasContent(start)
      ? start
      : null
  ),
  start: (start) => draw.startStroke(start),
  cancel: draw.cancel
})

export const createDrawEraseDriver = (
  draw: Pick<DrawInputRuntime, 'startErase' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'draw.erase',
  priority: 610,
  resolve: (start) => (
    start.tool.type === 'draw'
    && start.tool.kind === 'eraser'
    && !start.editable
    && !start.ignoreInput
      ? start
      : null
  ),
  start: (start) => draw.startErase(start),
  cancel: draw.cancel
})

export const createEdgeCreateDriver = (
  connect: Pick<EdgeConnectInteraction, 'startCreate' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'edge.create',
  priority: 500,
  resolve: (start) => {
    if (start.tool.type !== 'edge') {
      return null
    }

    const canStartFromNodeHandle =
      start.pick.kind === 'node'
      && start.pick.part === 'connect'
      && Boolean(start.pick.side)

    return canStartFromNodeHandle || allowsCanvasContent(start)
      ? start
      : null
  },
  start: (start) => connect.startCreate(start),
  cancel: connect.cancel
})

export const createNodeTransformDriver = (
  transform: Pick<NodeTransformInteraction, 'start' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'node.transform',
  priority: 400,
  resolve: (start) => (
    start.tool.type === 'select'
    && (start.pick.kind === 'node' || start.pick.kind === 'selection-box')
    && start.pick.part === 'transform'
    && Boolean(start.pick.handle)
      ? start
      : null
  ),
  start: (start) => transform.start(start),
  cancel: transform.cancel
})

export const createEdgeReconnectDriver = (
  connect: Pick<EdgeConnectInteraction, 'startReconnect' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'edge.reconnect',
  priority: 390,
  resolve: (start) => (
    start.tool.type === 'select'
    && start.pick.kind === 'edge'
    && start.pick.part === 'end'
    && Boolean(start.pick.end)
      ? start
      : null
  ),
  start: (start) => connect.startReconnect(start),
  cancel: connect.cancel
})

export const createEdgeRouteDriver = (
  edge: Pick<EdgeInputRuntime, 'startRoute' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'edge.route',
  priority: 380,
  resolve: (start) => (
    start.tool.type === 'select'
    && start.pick.kind === 'edge'
    && start.pick.part === 'path'
      ? start
      : null
  ),
  start: (start) => edge.startRoute(start),
  cancel: edge.cancel
})

export const createEdgeBodyDriver = (
  edge: Pick<EdgeInputRuntime, 'startBody' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'edge.body',
  priority: 370,
  resolve: (start) => (
    start.tool.type === 'select'
    && start.pick.kind === 'edge'
    && start.pick.part === 'body'
      ? start
      : null
  ),
  start: (start) => edge.startBody(start),
  cancel: edge.cancel
})

export const createMindmapDragDriver = (
  drag: Pick<MindmapDragInteraction, 'start' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'mindmap.drag',
  priority: 360,
  resolve: (start) => (
    start.tool.type === 'select'
    && start.pick.kind === 'mindmap'
    && allowsCanvasContent(start)
      ? start
      : null
  ),
  start: (start) => drag.start(start),
  cancel: drag.cancel
})

export const createSelectionPressDriver = (
  selection: Pick<SelectionPressRuntime, 'start' | 'cancel'>
): InteractionDriver<PointerDown> => ({
  kind: 'selection.start',
  priority: 100,
  resolve: (start) => (
    start.tool.type === 'select'
    && start.pick.kind !== 'edge'
    && start.pick.kind !== 'mindmap'
    && allowsCanvasContent(start)
      ? start
      : null
  ),
  start: (start) => selection.start(start),
  cancel: selection.cancel
})

export const createInteractionDrivers = (
  editor: InputDriverDeps
): readonly InteractionDriver[] => [
  createDrawEraseDriver(editor.draw),
  createDrawStrokeDriver(editor.draw),
  createInsertPresetDriver(editor),
  createEdgeCreateDriver(editor.edge.connect),
  createNodeTransformDriver(editor.node.transform),
  createEdgeReconnectDriver(editor.edge.connect),
  createEdgeRouteDriver(editor.edge.edit),
  createEdgeBodyDriver(editor.edge.edit),
  createMindmapDragDriver(editor.mindmap.drag),
  createSelectionPressDriver(editor.selection)
]
