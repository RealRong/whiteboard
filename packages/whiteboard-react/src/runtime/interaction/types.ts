import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { TransformHandle } from '@whiteboard/core/node'
import type { EdgeId, MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { ValueView } from '../view'

export type InteractionSession =
  | { kind: 'idle' }
  | { kind: 'selection-box' }
  | { kind: 'node-drag' }
  | { kind: 'node-transform' }
  | { kind: 'edge-connect' }
  | { kind: 'edge-routing' }

export type ActiveInteractionSessionKind = Exclude<
  InteractionSession['kind'],
  'idle'
>

export type NodeInteractionRuntime = {
  pointer: ValueView<number | null>
  cancel: (pointerId?: number) => void
  handleNodePointerDown: (
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  handleNodeDoubleClick: (
    nodeId: NodeId,
    event: ReactMouseEvent<HTMLDivElement>
  ) => void
  handleTransformPointerDown: (
    nodeId: NodeId,
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  onWindowPointerMove: (event: PointerEvent) => void
  onWindowPointerUp: (event: PointerEvent) => void
  onWindowPointerCancel: (event: PointerEvent) => void
  onWindowBlur: () => void
  onWindowKeyDown: (event: KeyboardEvent) => void
}

export type SelectionInteractionRuntime = {
  pointer: ValueView<number | null>
  cancel: (pointerId?: number) => void
  handleContainerPointerDown: (
    event: PointerEvent,
    container: HTMLDivElement
  ) => void
  onWindowPointerMove: (event: PointerEvent) => void
  onWindowPointerUp: (event: PointerEvent) => void
  onWindowPointerCancel: (event: PointerEvent) => void
  onWindowBlur: () => void
  onWindowKeyDown: (event: KeyboardEvent) => void
}

export type EdgeConnectInteractionRuntime = {
  pointer: ValueView<number | null>
  cancel: (pointerId?: number) => void
  handleContainerPointerDown: (
    event: PointerEvent,
    container: HTMLDivElement
  ) => void
  handleContainerPointerMove: (event: PointerEvent) => void
  handleContainerPointerLeave: () => void
  onWindowPointerMove: (event: PointerEvent) => void
  onWindowPointerUp: (event: PointerEvent) => void
  onWindowPointerCancel: (event: PointerEvent) => void
  onWindowBlur: () => void
  onWindowKeyDown: (event: KeyboardEvent) => void
}

export type EdgeRoutingInteractionRuntime = {
  pointer: ValueView<number | null>
  cancel: (pointerId?: number) => void
  handleEdgePathPointerDown: (
    event: ReactPointerEvent<SVGPathElement>
  ) => void
  handleRoutingPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    edgeId: EdgeId,
    index: number
  ) => void
  handleRoutingKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    edgeId: EdgeId,
    index: number
  ) => void
  onWindowPointerMove: (event: PointerEvent) => void
  onWindowPointerUp: (event: PointerEvent) => void
  onWindowPointerCancel: (event: PointerEvent) => void
  onWindowBlur: () => void
  onWindowKeyDown: (event: KeyboardEvent) => void
}

export type MindmapDragInteractionRuntime = {
  pointer: ValueView<number | null>
  cancel: (pointerId?: number) => void
  handleMindmapNodePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => void
  onWindowPointerMove: (event: PointerEvent) => void
  onWindowPointerUp: (event: PointerEvent) => void
  onWindowPointerCancel: (event: PointerEvent) => void
  onWindowBlur: () => void
  onWindowKeyDown: (event: KeyboardEvent) => void
}

export type WhiteboardInteractionRuntime = {
  session: ValueView<InteractionSession>
  node: NodeInteractionRuntime
  selection: SelectionInteractionRuntime
  edgeConnect: EdgeConnectInteractionRuntime
  edgeRouting: EdgeRoutingInteractionRuntime
  mindmapDrag: MindmapDragInteractionRuntime
  clear: () => void
}
