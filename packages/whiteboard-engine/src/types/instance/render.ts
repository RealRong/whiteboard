import type { Guide } from '../node/snap'
import type {
  GroupHoverState,
  InteractionSessionState,
  MindmapDragState,
  NodeDragState,
  NodePreviewState,
  SelectionBoxState,
  ViewportGestureState
} from '../state'

export type RenderSnapshot = {
  interactionSession: InteractionSessionState
  selectionBox: SelectionBoxState
  viewportGesture: ViewportGestureState
  mindmapDrag: MindmapDragState
  nodeDrag: NodeDragState
  nodePreview: NodePreviewState
  spacePressed: boolean
  dragGuides: Guide[]
  groupHover: GroupHoverState
}

export type RenderKey = keyof RenderSnapshot
export type WritableRenderSnapshot = RenderSnapshot
export type WritableRenderKey = keyof WritableRenderSnapshot

export type Render = {
  read: <K extends RenderKey>(key: K) => RenderSnapshot[K]
  write: <K extends WritableRenderKey>(
    key: K,
    next:
      | WritableRenderSnapshot[K]
      | ((prev: WritableRenderSnapshot[K]) => WritableRenderSnapshot[K])
  ) => void
  batch: (action: () => void) => void
  batchFrame: (action: () => void) => void
  watchChanges: (listener: (key: RenderKey) => void) => () => void
  watch: (key: RenderKey, listener: () => void) => () => void
}
