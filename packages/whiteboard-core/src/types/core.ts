import type {
  MindmapAttachPayload,
  MindmapNode,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  MindmapId,
  MindmapLayoutOptions
} from '../mindmap/types'

export type {
  MindmapAttachPayload,
  MindmapNode,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  MindmapId,
  MindmapLayoutOptions
} from '../mindmap/types'

export type DocumentId = string
export type NodeId = string
export type EdgeId = string

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Rect = { x: number; y: number; width: number; height: number }
export type Viewport = { center: Point; zoom: number }

export type NodeType = string

export interface Node {
  id: NodeId
  type: NodeType
  position: Point
  size?: Size
  rotation?: number
  layer?: 'background' | 'default' | 'overlay'
  zIndex?: number
  parentId?: NodeId
  locked?: boolean
  data?: Record<string, unknown>
  style?: Record<string, string | number>
}

export type EdgeAnchor = {
  side: 'top' | 'right' | 'bottom' | 'left'
  offset: number
}

export type EdgeBaseType = 'linear' | 'step' | 'polyline' | 'bezier' | 'curve' | 'custom'
export type EdgeType = EdgeBaseType | (string & {})

export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'color' | 'enum' | 'text'
export type SchemaFieldScope = 'data' | 'style' | 'label'

export type SchemaFieldOption = { label: string; value: string | number }

export type SchemaFieldVisibility = {
  scope?: SchemaFieldScope
  path: string
  equals?: unknown
  notEquals?: unknown
  exists?: boolean
}

export type SchemaField = {
  id: string
  label: string
  type: SchemaFieldType
  scope?: SchemaFieldScope
  path: string
  defaultValue?: unknown
  required?: boolean
  options?: SchemaFieldOption[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  description?: string
  readonly?: boolean
  visibleIf?: SchemaFieldVisibility
}

export type NodeSchema = {
  type: NodeType
  label?: string
  fields: SchemaField[]
}

export type EdgeSchema = {
  type: EdgeType
  label?: string
  fields: SchemaField[]
}

export type EdgeRouteMode = 'auto' | 'manual'

export type EdgeRouting = {
  mode?: EdgeRouteMode
  points?: Point[]
  locked?: boolean[]
  avoid?: {
    enabled?: boolean
    padding?: number
    maxTurns?: number
    strategy?: 'simple' | 'grid' | 'visibility'
  }
  ortho?: {
    offset?: number
    radius?: number
  }
}

export type EdgeStyle = {
  stroke?: string
  strokeWidth?: number
  dash?: number[]
  animated?: boolean
  animationSpeed?: number
  markerStart?: string
  markerEnd?: string
}

export type EdgeLabel = {
  text?: string
  position?: 'center' | 'start' | 'end'
  offset?: Point
}

export interface Edge {
  id: EdgeId
  source: { nodeId: NodeId; anchor?: EdgeAnchor }
  target: { nodeId: NodeId; anchor?: EdgeAnchor }
  type: EdgeType
  routing?: EdgeRouting
  style?: EdgeStyle
  label?: EdgeLabel
  data?: Record<string, unknown>
}

export interface Document {
  id: DocumentId
  name?: string
  nodes: Node[]
  edges: Edge[]
  mindmaps?: MindmapTree[]
  order: {
    nodes: NodeId[]
    edges: EdgeId[]
  }
  background?: { type: 'dot' | 'line' | 'none'; color?: string }
  viewport?: Viewport
  meta?: { createdAt?: string; updatedAt?: string }
}

export interface Snapshot {
  schemaVersion: string
  document: Document
}

export type NodeInput = Omit<Node, 'id'> & { id?: NodeId }
export type EdgeInput = Omit<Edge, 'id'> & { id?: EdgeId }
export type NodePatch = Partial<Omit<Node, 'id' | 'type'>> & { type?: NodeType }
export type EdgePatch = Partial<Omit<Edge, 'id'>>

export type MindmapCreateInput = {
  id?: MindmapId
  rootId?: MindmapNodeId
  rootData?: MindmapNodeData
}

export type MindmapLayoutHint = {
  nodeSize?: Size
  mode?: 'simple' | 'tidy'
  options?: MindmapLayoutOptions
  anchorId?: MindmapNodeId
}

export type MindmapIntentOptions = {
  index?: number
  side?: 'left' | 'right'
  layout?: MindmapLayoutHint
}

export type MindmapSubtree = {
  nodes: Record<MindmapNodeId, MindmapNode>
  children: Record<MindmapNodeId, MindmapNodeId[]>
}

export type Intent =
  | { type: 'node.create'; payload: NodeInput }
  | { type: 'node.update'; id: NodeId; patch: NodePatch }
  | { type: 'node.delete'; ids: NodeId[] }
  | { type: 'node.order.set'; ids: NodeId[] }
  | { type: 'node.order.bringToFront'; ids: NodeId[] }
  | { type: 'node.order.sendToBack'; ids: NodeId[] }
  | { type: 'node.order.bringForward'; ids: NodeId[] }
  | { type: 'node.order.sendBackward'; ids: NodeId[] }
  | { type: 'edge.create'; payload: EdgeInput }
  | { type: 'edge.update'; id: EdgeId; patch: EdgePatch }
  | { type: 'edge.delete'; ids: EdgeId[] }
  | { type: 'edge.order.set'; ids: EdgeId[] }
  | { type: 'edge.order.bringToFront'; ids: EdgeId[] }
  | { type: 'edge.order.sendToBack'; ids: EdgeId[] }
  | { type: 'edge.order.bringForward'; ids: EdgeId[] }
  | { type: 'edge.order.sendBackward'; ids: EdgeId[] }
  | { type: 'mindmap.create'; payload?: MindmapCreateInput }
  | { type: 'mindmap.delete'; ids: MindmapId[] }
  | { type: 'mindmap.replace'; id: MindmapId; tree: MindmapTree }
  | {
      type: 'mindmap.addChild'
      id: MindmapId
      parentId: MindmapNodeId
      payload?: MindmapNodeData | MindmapAttachPayload
      options?: MindmapIntentOptions
    }
  | {
      type: 'mindmap.addSibling'
      id: MindmapId
      nodeId: MindmapNodeId
      position: 'before' | 'after'
      payload?: MindmapNodeData | MindmapAttachPayload
      options?: MindmapIntentOptions
    }
  | {
      type: 'mindmap.moveSubtree'
      id: MindmapId
      nodeId: MindmapNodeId
      newParentId: MindmapNodeId
      options?: MindmapIntentOptions
    }
  | { type: 'mindmap.removeSubtree'; id: MindmapId; nodeId: MindmapNodeId }
  | {
      type: 'mindmap.cloneSubtree'
      id: MindmapId
      nodeId: MindmapNodeId
      options?: { parentId?: MindmapNodeId; index?: number; side?: 'left' | 'right' }
    }
  | { type: 'mindmap.toggleCollapse'; id: MindmapId; nodeId: MindmapNodeId; collapsed?: boolean }
  | { type: 'mindmap.setNodeData'; id: MindmapId; nodeId: MindmapNodeId; patch: Partial<MindmapNodeData> }
  | { type: 'mindmap.reorderChild'; id: MindmapId; parentId: MindmapNodeId; fromIndex: number; toIndex: number }
  | { type: 'mindmap.setSide'; id: MindmapId; nodeId: MindmapNodeId; side: 'left' | 'right' }
  | {
      type: 'mindmap.attachExternal'
      id: MindmapId
      targetId: MindmapNodeId
      payload: MindmapAttachPayload
      options?: MindmapIntentOptions
    }
  | { type: 'viewport.set'; viewport: Viewport }
  | { type: 'viewport.pan'; delta: Point }
  | { type: 'viewport.zoom'; factor: number; anchor?: Point }

export type Operation =
  | { type: 'node.create'; node: Node }
  | { type: 'node.update'; id: NodeId; patch: NodePatch; before?: Node }
  | { type: 'node.delete'; id: NodeId; before?: Node }
  | { type: 'node.order.set'; ids: NodeId[]; before?: NodeId[] }
  | { type: 'node.order.bringToFront'; ids: NodeId[]; before?: NodeId[] }
  | { type: 'node.order.sendToBack'; ids: NodeId[]; before?: NodeId[] }
  | { type: 'node.order.bringForward'; ids: NodeId[]; before?: NodeId[] }
  | { type: 'node.order.sendBackward'; ids: NodeId[]; before?: NodeId[] }
  | { type: 'edge.create'; edge: Edge }
  | { type: 'edge.update'; id: EdgeId; patch: EdgePatch; before?: Edge }
  | { type: 'edge.delete'; id: EdgeId; before?: Edge }
  | { type: 'edge.order.set'; ids: EdgeId[]; before?: EdgeId[] }
  | { type: 'edge.order.bringToFront'; ids: EdgeId[]; before?: EdgeId[] }
  | { type: 'edge.order.sendToBack'; ids: EdgeId[]; before?: EdgeId[] }
  | { type: 'edge.order.bringForward'; ids: EdgeId[]; before?: EdgeId[] }
  | { type: 'edge.order.sendBackward'; ids: EdgeId[]; before?: EdgeId[] }
  | { type: 'mindmap.create'; mindmap: MindmapTree }
  | { type: 'mindmap.replace'; id: MindmapId; before?: MindmapTree; after: MindmapTree }
  | { type: 'mindmap.delete'; id: MindmapId; before?: MindmapTree }
  | { type: 'mindmap.node.create'; id: MindmapId; node: MindmapNode; parentId: MindmapNodeId; index?: number }
  | { type: 'mindmap.node.update'; id: MindmapId; nodeId: MindmapNodeId; patch: Partial<MindmapNode>; before?: MindmapNode }
  | {
      type: 'mindmap.node.delete'
      id: MindmapId
      nodeId: MindmapNodeId
      parentId?: MindmapNodeId
      index?: number
      subtree: MindmapSubtree
    }
  | {
      type: 'mindmap.node.move'
      id: MindmapId
      nodeId: MindmapNodeId
      fromParentId: MindmapNodeId
      toParentId: MindmapNodeId
      fromIndex: number
      toIndex: number
      side?: 'left' | 'right'
    }
  | { type: 'mindmap.node.reorder'; id: MindmapId; parentId: MindmapNodeId; fromIndex: number; toIndex: number }
  | { type: 'viewport.update'; before?: Viewport; after: Viewport }

export interface ChangeSet {
  id: string
  timestamp: number
  operations: Operation[]
  origin?: 'user' | 'remote' | 'system'
}

export interface BeforeChangeSet {
  changes: ChangeSet
  cancel(): void
}

export interface AfterChangeSet {
  changes: ChangeSet
}

export interface TransactionSummary {
  changes: ChangeSet[]
}

export type CoreEvent =
  | { type: 'changes.applied'; changes: ChangeSet }
  | { type: 'node.created'; node: Node }
  | { type: 'node.updated'; id: NodeId; patch: NodePatch }
  | { type: 'node.deleted'; id: NodeId }
  | { type: 'edge.created'; edge: Edge }
  | { type: 'edge.updated'; id: EdgeId; patch: EdgePatch }
  | { type: 'edge.deleted'; id: EdgeId }
  | { type: 'mindmap.created'; mindmap: MindmapTree }
  | { type: 'mindmap.updated'; id: MindmapId; mindmap: MindmapTree }
  | { type: 'mindmap.deleted'; id: MindmapId }
  | { type: 'mindmap.node.created'; id: MindmapId; node: MindmapNode }
  | { type: 'mindmap.node.updated'; id: MindmapId; nodeId: MindmapNodeId; patch: Partial<MindmapNode> }
  | { type: 'mindmap.node.deleted'; id: MindmapId; nodeId: MindmapNodeId }
  | { type: 'mindmap.node.moved'; id: MindmapId; nodeId: MindmapNodeId; toParentId: MindmapNodeId }
  | { type: 'mindmap.node.reordered'; id: MindmapId; parentId: MindmapNodeId; fromIndex: number; toIndex: number }
  | { type: 'viewport.updated'; viewport: Viewport }

export interface PluginHost {
  use(plugin: Plugin): void
  has(id: string): boolean
  activate(id: string): void
  deactivate(id: string): void
  list(): PluginManifest[]
}

export interface CommandRegistry {
  register(name: string, handler: (...args: unknown[]) => void): () => void
  get(name: string): ((...args: unknown[]) => void) | undefined
  list(): string[]
}

export interface NodeTypeDefinition {
  type: NodeType
  label?: string
  defaultData?: Record<string, unknown>
  schema?: NodeSchema
  validate?: (data: unknown) => boolean
}

export interface EdgeTypeDefinition {
  type: EdgeType
  label?: string
  defaultData?: Record<string, unknown>
  schema?: EdgeSchema
  validate?: (data: unknown) => boolean
}

export interface Serializer {
  type: string
  serialize(document: Document): unknown
  deserialize(input: unknown): Document
}

export interface Registry<T> {
  get(id: string): T | undefined
  list(): T[]
  register(definition: T): () => void
  unregister(id: string): void
  has(id: string): boolean
}

export interface SchemaRegistry {
  registerNode(schema: NodeSchema): () => void
  registerEdge(schema: EdgeSchema): () => void
  getNode(type: NodeType): NodeSchema | undefined
  getEdge(type: EdgeType): EdgeSchema | undefined
  listNodes(): NodeSchema[]
  listEdges(): EdgeSchema[]
}

export interface CoreRegistries {
  nodeTypes: Registry<NodeTypeDefinition>
  edgeTypes: Registry<EdgeTypeDefinition>
  schemas: SchemaRegistry
  serializers: Registry<Serializer>
  commands: CommandRegistry
}

export interface PluginContext {
  core: Core
  registries: CoreRegistries
  commands: CommandRegistry
}

export interface PluginManifest {
  id: string
  name?: string
  version?: string
  requires?: string[]
  capabilities?: string[]
}

export interface Plugin {
  manifest: PluginManifest
  install?: (ctx: PluginContext) => void
  activate?: (ctx: PluginContext) => void
  deactivate?: (ctx: PluginContext) => void
  commands?: Record<string, (...args: any[]) => void>
  nodes?: NodeTypeDefinition[]
  edges?: EdgeTypeDefinition[]
  schemas?: {
    nodes?: NodeSchema[]
    edges?: EdgeSchema[]
  }
  serializers?: Serializer[]
}

export type Origin = 'user' | 'remote' | 'system'

export type DispatchFailureReason = 'cancelled' | 'invalid' | 'conflict' | 'unknown'

export interface DispatchFailure {
  ok: false
  reason: DispatchFailureReason
  message?: string
}

export interface DispatchSuccess {
  ok: true
  changes: ChangeSet
  value?: unknown
}

export type DispatchResult = DispatchSuccess | DispatchFailure

export interface CoreApplyOptions {
  origin?: Origin
}

export interface CoreBuildSuccess {
  ok: true
  operations: Operation[]
  value?: unknown
}

export type CoreBuildResult = CoreBuildSuccess | DispatchFailure

export interface TransactionOptions {
  origin?: Origin
  transactionId?: string
  label?: string
}

export interface TransactionResult<T = void> {
  result: T
  changes: ChangeSet[]
}

export interface CoreHistoryApi {
  undo(): boolean
  redo(): boolean
  clear(): void
  configure(config: Partial<CoreHistoryConfig>): void
  getState(): CoreHistoryState
  subscribe(listener: (state: CoreHistoryState) => void): () => void
}

export interface CoreTxApi {
  <T>(fn: () => T | Promise<T>, options?: TransactionOptions): Promise<TransactionResult<T>>
}

export type CoreHistoryState = {
  canUndo: boolean
  canRedo: boolean
  undoDepth: number
  redoDepth: number
  isApplying: boolean
  lastUpdatedAt: number
}

export type CoreHistoryConfig = {
  enabled: boolean
  capacity: number
  captureSystem: boolean
  captureRemote: boolean
}

export interface Core {
  query: {
    document(): Document
    node: {
      get(id: NodeId): Node | undefined
      list(): Node[]
    }
    edge: {
      get(id: EdgeId): Edge | undefined
      list(): Edge[]
      byNode(id: NodeId): Edge[]
    }
    mindmap: {
      get(id: MindmapId): MindmapTree | undefined
      list(): MindmapTree[]
    }
    viewport(): Viewport
  }

  apply: {
    build(intent: Intent): CoreBuildResult
    intent(intent: Intent, options?: CoreApplyOptions): DispatchResult
    operations(operations: Operation[], options?: CoreApplyOptions): DispatchResult
    changeSet(changes: ChangeSet): DispatchResult
  }

  model: {
    node: {
      create(input: NodeInput): NodeId
      update(id: NodeId, patch: NodePatch): void
      updateMany(updates: Array<{ id: NodeId; patch: NodePatch }>): void
      delete(ids: NodeId[]): void
    }
    edge: {
      create(input: EdgeInput): EdgeId
      update(id: EdgeId, patch: EdgePatch): void
      delete(ids: EdgeId[]): void
    }
    mindmap: {
      create(input?: MindmapCreateInput | MindmapTree): MindmapId
      update(id: MindmapId, tree: MindmapTree): void
      delete(ids: MindmapId[]): void
    }
  }

  commands: {
    node: {
      move(ids: NodeId[], delta: Point): Promise<DispatchResult>
      resize(id: NodeId, size: Size): Promise<DispatchResult>
      rotate?(id: NodeId, angle: number): Promise<DispatchResult>
    }
    order: {
      node: {
        set(ids: NodeId[]): Promise<DispatchResult>
        bringToFront(ids: NodeId[]): Promise<DispatchResult>
        sendToBack(ids: NodeId[]): Promise<DispatchResult>
        bringForward(ids: NodeId[]): Promise<DispatchResult>
        sendBackward(ids: NodeId[]): Promise<DispatchResult>
      }
      edge: {
        set(ids: EdgeId[]): Promise<DispatchResult>
        bringToFront(ids: EdgeId[]): Promise<DispatchResult>
        sendToBack(ids: EdgeId[]): Promise<DispatchResult>
        bringForward(ids: EdgeId[]): Promise<DispatchResult>
        sendBackward(ids: EdgeId[]): Promise<DispatchResult>
      }
    }
    edge: {
      connect(
        source: { nodeId: NodeId; anchor?: EdgeAnchor },
        target: { nodeId: NodeId; anchor?: EdgeAnchor }
      ): Promise<DispatchResult>
      reconnect(
        id: EdgeId,
        end: 'source' | 'target',
        ref: { nodeId: NodeId; anchor?: EdgeAnchor }
      ): Promise<DispatchResult>
    }
    group: {
      create(ids: NodeId[]): Promise<DispatchResult>
      ungroup(id: NodeId): Promise<DispatchResult>
    }
    layout?: {
      align(
        ids: NodeId[],
        mode: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY'
      ): Promise<DispatchResult>
      distribute?(ids: NodeId[], axis: 'x' | 'y'): Promise<DispatchResult>
    }
    mindmap: {
      create(payload?: MindmapCreateInput): Promise<DispatchResult>
      replace(id: MindmapId, tree: MindmapTree): Promise<DispatchResult>
      delete(ids: MindmapId[]): Promise<DispatchResult>
      addChild(
        id: MindmapId,
        parentId: MindmapNodeId,
        payload?: MindmapNodeData | MindmapAttachPayload,
        options?: MindmapIntentOptions
      ): Promise<DispatchResult>
      addSibling(
        id: MindmapId,
        nodeId: MindmapNodeId,
        position: 'before' | 'after',
        payload?: MindmapNodeData | MindmapAttachPayload,
        options?: MindmapIntentOptions
      ): Promise<DispatchResult>
      moveSubtree(
        id: MindmapId,
        nodeId: MindmapNodeId,
        newParentId: MindmapNodeId,
        options?: MindmapIntentOptions
      ): Promise<DispatchResult>
      removeSubtree(id: MindmapId, nodeId: MindmapNodeId): Promise<DispatchResult>
      cloneSubtree(
        id: MindmapId,
        nodeId: MindmapNodeId,
        options?: { parentId?: MindmapNodeId; index?: number; side?: 'left' | 'right' }
      ): Promise<DispatchResult>
      toggleCollapse(id: MindmapId, nodeId: MindmapNodeId, collapsed?: boolean): Promise<DispatchResult>
      setNodeData(id: MindmapId, nodeId: MindmapNodeId, patch: Partial<MindmapNodeData>): Promise<DispatchResult>
      reorderChild(id: MindmapId, parentId: MindmapNodeId, fromIndex: number, toIndex: number): Promise<DispatchResult>
      setSide(id: MindmapId, nodeId: MindmapNodeId, side: 'left' | 'right'): Promise<DispatchResult>
      attachExternal(
        id: MindmapId,
        targetId: MindmapNodeId,
        payload: MindmapAttachPayload,
        options?: MindmapIntentOptions
      ): Promise<DispatchResult>
    }
    viewport: {
      set(viewport: Viewport): Promise<DispatchResult>
      panBy(delta: Point): Promise<DispatchResult>
      zoomBy(factor: number, anchor?: Point): Promise<DispatchResult>
      zoomTo(zoom: number, anchor?: Point): Promise<DispatchResult>
      reset(): Promise<DispatchResult>
      fitToView(rect: Rect, options: { viewportSize: Size; padding?: number }): Promise<DispatchResult>
    }
  }

  history: CoreHistoryApi
  tx: CoreTxApi

  registries: CoreRegistries

  events: {
    on<T extends CoreEvent>(type: T['type'], handler: (e: T) => void): void
    off<T extends CoreEvent>(type: T['type'], handler: (e: T) => void): void
  }

  changes: {
    onBefore(handler: (e: BeforeChangeSet) => void | false): () => void
    onAfter(handler: (e: AfterChangeSet) => void): () => void
    transactionStart(handler: () => void): () => void
    transactionEnd(handler: (e: TransactionSummary) => void): () => void
  }

  serialize(): Snapshot
  load(snapshot: Snapshot): void

  plugins: PluginHost
}
