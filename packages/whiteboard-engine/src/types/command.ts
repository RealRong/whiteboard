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

export type CommandSource =
  | 'ui'
  | 'shortcut'
  | 'remote'
  | 'import'
  | 'system'
  | 'command'
  | 'interaction'

type CommandBase<TType extends string> = {
  type: TType
}

export type DocResetCommand = CommandBase<'doc.reset'> & {
  doc: Document
}

export type NodeCreateCommand = CommandBase<'node.create'> & {
  payload: NodeInput
}

export type NodeUpdateCommand = CommandBase<'node.update'> & {
  id: NodeId
  patch: NodePatch
}

export type NodeDeleteCommand = CommandBase<'node.delete'> & {
  ids: NodeId[]
}

export type NodeMoveCommand = CommandBase<'node.move'> & {
  ids: NodeId[]
  delta: Point
}

export type NodeResizeCommand = CommandBase<'node.resize'> & {
  id: NodeId
  size: Size
}

export type NodeRotateCommand = CommandBase<'node.rotate'> & {
  id: NodeId
  angle: number
}

export type EdgeCreateCommand = CommandBase<'edge.create'> & {
  payload: EdgeInput
}

export type EdgeUpdateCommand = CommandBase<'edge.update'> & {
  id: EdgeId
  patch: EdgePatch
}

export type EdgeDeleteCommand = CommandBase<'edge.delete'> & {
  ids: EdgeId[]
}

export type EdgeConnectCommand = CommandBase<'edge.connect'> & {
  source: { nodeId: NodeId; anchor?: EdgeAnchor }
  target: { nodeId: NodeId; anchor?: EdgeAnchor }
}

export type EdgeReconnectCommand = CommandBase<'edge.reconnect'> & {
  id: EdgeId
  end: 'source' | 'target'
  ref: { nodeId: NodeId; anchor?: EdgeAnchor }
}

export type NodeOrderSetCommand = CommandBase<'node.order.set'> & {
  ids: NodeId[]
}

export type NodeOrderBringToFrontCommand = CommandBase<'node.order.bringToFront'> & {
  ids: NodeId[]
}

export type NodeOrderSendToBackCommand = CommandBase<'node.order.sendToBack'> & {
  ids: NodeId[]
}

export type NodeOrderBringForwardCommand = CommandBase<'node.order.bringForward'> & {
  ids: NodeId[]
}

export type NodeOrderSendBackwardCommand = CommandBase<'node.order.sendBackward'> & {
  ids: NodeId[]
}

export type EdgeOrderSetCommand = CommandBase<'edge.order.set'> & {
  ids: EdgeId[]
}

export type EdgeOrderBringToFrontCommand = CommandBase<'edge.order.bringToFront'> & {
  ids: EdgeId[]
}

export type EdgeOrderSendToBackCommand = CommandBase<'edge.order.sendToBack'> & {
  ids: EdgeId[]
}

export type EdgeOrderBringForwardCommand = CommandBase<'edge.order.bringForward'> & {
  ids: EdgeId[]
}

export type EdgeOrderSendBackwardCommand = CommandBase<'edge.order.sendBackward'> & {
  ids: EdgeId[]
}

export type GroupCreateCommand = CommandBase<'group.create'> & {
  ids: NodeId[]
}

export type GroupUngroupCommand = CommandBase<'group.ungroup'> & {
  id: NodeId
}

export type ViewportSetCommand = CommandBase<'viewport.set'> & {
  viewport: Viewport
}

export type ViewportPanByCommand = CommandBase<'viewport.panBy'> & {
  delta: Point
}

export type ViewportZoomByCommand = CommandBase<'viewport.zoomBy'> & {
  factor: number
  anchor?: Point
}

export type ViewportZoomToCommand = CommandBase<'viewport.zoomTo'> & {
  zoom: number
  anchor?: Point
}

export type ViewportResetCommand = CommandBase<'viewport.reset'>

export type MindmapCreateCommand = CommandBase<'mindmap.create'> & {
  payload?: MindmapCreateInput
}

export type MindmapReplaceCommand = CommandBase<'mindmap.replace'> & {
  id: MindmapId
  tree: MindmapTree
}

export type MindmapDeleteCommand = CommandBase<'mindmap.delete'> & {
  ids: MindmapId[]
}

export type MindmapAddChildCommand = CommandBase<'mindmap.addChild'> & {
  id: MindmapId
  parentId: MindmapNodeId
  payload?: MindmapNodeData | MindmapAttachPayload
  options?: MindmapIntentOptions
}

export type MindmapAddSiblingCommand = CommandBase<'mindmap.addSibling'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  position: 'before' | 'after'
  payload?: MindmapNodeData | MindmapAttachPayload
  options?: MindmapIntentOptions
}

export type MindmapMoveSubtreeCommand = CommandBase<'mindmap.moveSubtree'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  newParentId: MindmapNodeId
  options?: MindmapIntentOptions
}

export type MindmapRemoveSubtreeCommand = CommandBase<'mindmap.removeSubtree'> & {
  id: MindmapId
  nodeId: MindmapNodeId
}

export type MindmapCloneSubtreeCommand = CommandBase<'mindmap.cloneSubtree'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  options?: { parentId?: MindmapNodeId; index?: number; side?: 'left' | 'right' }
}

export type MindmapToggleCollapseCommand = CommandBase<'mindmap.toggleCollapse'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  collapsed?: boolean
}

export type MindmapSetNodeDataCommand = CommandBase<'mindmap.setNodeData'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  patch: Partial<MindmapNodeData>
}

export type MindmapReorderChildCommand = CommandBase<'mindmap.reorderChild'> & {
  id: MindmapId
  parentId: MindmapNodeId
  fromIndex: number
  toIndex: number
}

export type MindmapSetSideCommand = CommandBase<'mindmap.setSide'> & {
  id: MindmapId
  nodeId: MindmapNodeId
  side: 'left' | 'right'
}

export type MindmapAttachExternalCommand = CommandBase<'mindmap.attachExternal'> & {
  id: MindmapId
  targetId: MindmapNodeId
  payload: MindmapAttachPayload
  options?: MindmapIntentOptions
}

export type Command =
  | DocResetCommand
  | NodeCreateCommand
  | NodeUpdateCommand
  | NodeDeleteCommand
  | NodeMoveCommand
  | NodeResizeCommand
  | NodeRotateCommand
  | EdgeCreateCommand
  | EdgeUpdateCommand
  | EdgeDeleteCommand
  | EdgeConnectCommand
  | EdgeReconnectCommand
  | NodeOrderSetCommand
  | NodeOrderBringToFrontCommand
  | NodeOrderSendToBackCommand
  | NodeOrderBringForwardCommand
  | NodeOrderSendBackwardCommand
  | EdgeOrderSetCommand
  | EdgeOrderBringToFrontCommand
  | EdgeOrderSendToBackCommand
  | EdgeOrderBringForwardCommand
  | EdgeOrderSendBackwardCommand
  | GroupCreateCommand
  | GroupUngroupCommand
  | ViewportSetCommand
  | ViewportPanByCommand
  | ViewportZoomByCommand
  | ViewportZoomToCommand
  | ViewportResetCommand
  | MindmapCreateCommand
  | MindmapReplaceCommand
  | MindmapDeleteCommand
  | MindmapAddChildCommand
  | MindmapAddSiblingCommand
  | MindmapMoveSubtreeCommand
  | MindmapRemoveSubtreeCommand
  | MindmapCloneSubtreeCommand
  | MindmapToggleCollapseCommand
  | MindmapSetNodeDataCommand
  | MindmapReorderChildCommand
  | MindmapSetSideCommand
  | MindmapAttachExternalCommand

export type CommandBatch = {
  id: string
  docId?: DocumentId
  source: CommandSource
  actor?: string
  timestamp: number
  commands: Command[]
}

export type CommandBatchInput =
  | Command[]
  | ({
      commands: Command[]
    } & Partial<Pick<CommandBatch, 'id' | 'docId' | 'source' | 'actor' | 'timestamp'>>)

export type ApplyOptions = Partial<Pick<CommandBatch, 'id' | 'docId' | 'source' | 'actor' | 'timestamp'>>

export type ApplyDispatchResult = {
  index: number
  type: Command['type']
  result: DispatchResult
}

export type ApplyMetrics = {
  durationMs: number
  commandCount: number
  dispatchCount: number
}

export type AppliedCommandSummary = {
  id: string
  docId?: DocumentId
  source: CommandSource
  actor?: string
  timestamp: number
  commandTypes: Command['type'][]
  operationTypes: string[]
  metrics: ApplyMetrics
}

export type ApplyResult = {
  commandBatch: CommandBatch
  dispatchResults: ApplyDispatchResult[]
  summary: AppliedCommandSummary
}

export type TxCollector = {
  add: (...commands: Command[]) => void
}

export type TxApi = <T>(
  run: (tx: TxCollector) => T | Promise<T>,
  options?: ApplyOptions
) => Promise<T>

export type ApplyApi = (
  input: CommandBatchInput,
  options?: ApplyOptions
) => Promise<ApplyResult>
