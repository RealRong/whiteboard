import type {
  DispatchResult,
  Document,
  DocumentId,
  EdgeAnchor,
  EdgeId,
  EdgeInput,
  EdgePatch,
  MindmapAttachPayload,
  MindmapCreateInput,
  MindmapId,
  MindmapIntentOptions,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Size,
  Viewport
} from '@whiteboard/core'

export type ChangeSource =
  | 'ui'
  | 'shortcut'
  | 'remote'
  | 'import'
  | 'system'
  | 'command'
  | 'interaction'

type ChangeBase<TType extends string> = {
  type: TType
}

export type DocResetChange = ChangeBase<'doc.reset'> & {
  doc: Document
}

export type NodeCreateChange = ChangeBase<'node.create'> & {
  payload: NodeInput
}

export type NodeUpdateChange = ChangeBase<'node.update'> & {
  id: NodeId
  patch: NodePatch
}

export type NodeDeleteChange = ChangeBase<'node.delete'> & {
  ids: NodeId[]
}

export type NodeMoveChange = ChangeBase<'node.move'> & {
  ids: NodeId[]
  delta: Point
}

export type NodeResizeChange = ChangeBase<'node.resize'> & {
  id: NodeId
  size: Size
}

export type NodeRotateChange = ChangeBase<'node.rotate'> & {
  id: NodeId
  angle: number
}

export type EdgeCreateChange = ChangeBase<'edge.create'> & {
  payload: EdgeInput
}

export type EdgeUpdateChange = ChangeBase<'edge.update'> & {
  id: EdgeId
  patch: EdgePatch
}

export type EdgeDeleteChange = ChangeBase<'edge.delete'> & {
  ids: EdgeId[]
}

export type EdgeConnectChange = ChangeBase<'edge.connect'> & {
  source: { nodeId: NodeId; anchor?: EdgeAnchor }
  target: { nodeId: NodeId; anchor?: EdgeAnchor }
}

export type EdgeReconnectChange = ChangeBase<'edge.reconnect'> & {
  id: EdgeId
  end: 'source' | 'target'
  ref: { nodeId: NodeId; anchor?: EdgeAnchor }
}

export type NodeOrderSetChange = ChangeBase<'node.order.set'> & {
  ids: NodeId[]
}

export type NodeOrderBringToFrontChange = ChangeBase<'node.order.bringToFront'> & {
  ids: NodeId[]
}

export type NodeOrderSendToBackChange = ChangeBase<'node.order.sendToBack'> & {
  ids: NodeId[]
}

export type NodeOrderBringForwardChange = ChangeBase<'node.order.bringForward'> & {
  ids: NodeId[]
}

export type NodeOrderSendBackwardChange = ChangeBase<'node.order.sendBackward'> & {
  ids: NodeId[]
}

export type EdgeOrderSetChange = ChangeBase<'edge.order.set'> & {
  ids: EdgeId[]
}

export type EdgeOrderBringToFrontChange = ChangeBase<'edge.order.bringToFront'> & {
  ids: EdgeId[]
}

export type EdgeOrderSendToBackChange = ChangeBase<'edge.order.sendToBack'> & {
  ids: EdgeId[]
}

export type EdgeOrderBringForwardChange = ChangeBase<'edge.order.bringForward'> & {
  ids: EdgeId[]
}

export type EdgeOrderSendBackwardChange = ChangeBase<'edge.order.sendBackward'> & {
  ids: EdgeId[]
}

export type GroupCreateChange = ChangeBase<'group.create'> & {
  ids: NodeId[]
}

export type GroupUngroupChange = ChangeBase<'group.ungroup'> & {
  id: NodeId
}

export type ViewportSetChange = ChangeBase<'viewport.set'> & {
  viewport: Viewport
}

export type ViewportPanByChange = ChangeBase<'viewport.panBy'> & {
  delta: Point
}

export type ViewportZoomByChange = ChangeBase<'viewport.zoomBy'> & {
  factor: number
  anchor?: Point
}

export type ViewportZoomToChange = ChangeBase<'viewport.zoomTo'> & {
  zoom: number
  anchor?: Point
}

export type ViewportResetChange = ChangeBase<'viewport.reset'>

export type MindmapCreateChange = ChangeBase<'mindmap.create'> & {
  payload?: MindmapCreateInput
}

export type MindmapReplaceChange = ChangeBase<'mindmap.replace'> & {
  id: MindmapId
  tree: MindmapTree
}

export type MindmapDeleteChange = ChangeBase<'mindmap.delete'> & {
  ids: MindmapId[]
}

export type MindmapAddChildChange = ChangeBase<'mindmap.addChild'> & {
  id: MindmapId
  parentId: MindmapNodeId
  payload?: MindmapNodeData | MindmapAttachPayload
  options?: MindmapIntentOptions
}

export type MindmapAddSiblingChange = ChangeBase<'mindmap.addSibling'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  position: 'before' | 'after'
  payload?: MindmapNodeData | MindmapAttachPayload
  options?: MindmapIntentOptions
}

export type MindmapMoveSubtreeChange = ChangeBase<'mindmap.moveSubtree'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  newParentId: MindmapNodeId
  options?: MindmapIntentOptions
}

export type MindmapRemoveSubtreeChange = ChangeBase<'mindmap.removeSubtree'> & {
  id: MindmapId
  nodeId: MindmapNodeId
}

export type MindmapCloneSubtreeChange = ChangeBase<'mindmap.cloneSubtree'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  options?: { parentId?: MindmapNodeId; index?: number; side?: 'left' | 'right' }
}

export type MindmapToggleCollapseChange = ChangeBase<'mindmap.toggleCollapse'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  collapsed?: boolean
}

export type MindmapSetNodeDataChange = ChangeBase<'mindmap.setNodeData'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  patch: Partial<MindmapNodeData>
}

export type MindmapReorderChildChange = ChangeBase<'mindmap.reorderChild'> & {
  id: MindmapId
  parentId: MindmapNodeId
  fromIndex: number
  toIndex: number
}

export type MindmapSetSideChange = ChangeBase<'mindmap.setSide'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  side: 'left' | 'right'
}

export type MindmapAttachExternalChange = ChangeBase<'mindmap.attachExternal'> & {
  id: MindmapId
  targetId: MindmapNodeId
  payload: MindmapAttachPayload
  options?: MindmapIntentOptions
}

export type Change =
  | DocResetChange
  | NodeCreateChange
  | NodeUpdateChange
  | NodeDeleteChange
  | NodeMoveChange
  | NodeResizeChange
  | NodeRotateChange
  | EdgeCreateChange
  | EdgeUpdateChange
  | EdgeDeleteChange
  | EdgeConnectChange
  | EdgeReconnectChange
  | NodeOrderSetChange
  | NodeOrderBringToFrontChange
  | NodeOrderSendToBackChange
  | NodeOrderBringForwardChange
  | NodeOrderSendBackwardChange
  | EdgeOrderSetChange
  | EdgeOrderBringToFrontChange
  | EdgeOrderSendToBackChange
  | EdgeOrderBringForwardChange
  | EdgeOrderSendBackwardChange
  | GroupCreateChange
  | GroupUngroupChange
  | ViewportSetChange
  | ViewportPanByChange
  | ViewportZoomByChange
  | ViewportZoomToChange
  | ViewportResetChange
  | MindmapCreateChange
  | MindmapReplaceChange
  | MindmapDeleteChange
  | MindmapAddChildChange
  | MindmapAddSiblingChange
  | MindmapMoveSubtreeChange
  | MindmapRemoveSubtreeChange
  | MindmapCloneSubtreeChange
  | MindmapToggleCollapseChange
  | MindmapSetNodeDataChange
  | MindmapReorderChildChange
  | MindmapSetSideChange
  | MindmapAttachExternalChange

export type ChangeSet = {
  id: string
  docId?: DocumentId
  source: ChangeSource
  actor?: string
  timestamp: number
  changes: Change[]
}

export type ChangeSetInput =
  | Change[]
  | ({
      changes: Change[]
    } & Partial<Pick<ChangeSet, 'id' | 'docId' | 'source' | 'actor' | 'timestamp'>>)

export type ApplyOptions = Partial<Pick<ChangeSet, 'id' | 'docId' | 'source' | 'actor' | 'timestamp'>>

export type ApplyDispatchResult = {
  index: number
  type: Change['type']
  result: DispatchResult
}

export type ApplyMetrics = {
  durationMs: number
  changeCount: number
  dispatchCount: number
}

export type AppliedChangeSummary = {
  id: string
  docId?: DocumentId
  source: ChangeSource
  actor?: string
  timestamp: number
  types: Change['type'][]
  operationTypes: string[]
  metrics: ApplyMetrics
}

export type ApplyResult = {
  changeSet: ChangeSet
  dispatchResults: ApplyDispatchResult[]
  summary: AppliedChangeSummary
}

export type TxCollector = {
  add: (...changes: Change[]) => void
}

export type TxApi = <T>(
  run: (tx: TxCollector) => T | Promise<T>,
  options?: ApplyOptions
) => Promise<T>

export type ApplyApi = (
  input: ChangeSetInput,
  options?: ApplyOptions
) => Promise<ApplyResult>
