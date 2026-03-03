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

export type MindmapCommandOptions = {
  index?: number
  side?: 'left' | 'right'
  layout?: MindmapLayoutHint
}

export type MindmapSubtree = {
  nodes: Record<MindmapNodeId, MindmapNode>
  children: Record<MindmapNodeId, MindmapNodeId[]>
}

export type Operation =
  | { readonly type: 'node.create'; readonly node: Node }
  | { readonly type: 'node.update'; readonly id: NodeId; readonly patch: NodePatch; readonly before?: Node }
  | { readonly type: 'node.delete'; readonly id: NodeId; readonly before?: Node }
  | { readonly type: 'node.order.set'; readonly ids: readonly NodeId[]; readonly before?: readonly NodeId[] }
  | { readonly type: 'node.order.bringToFront'; readonly ids: readonly NodeId[]; readonly before?: readonly NodeId[] }
  | { readonly type: 'node.order.sendToBack'; readonly ids: readonly NodeId[]; readonly before?: readonly NodeId[] }
  | { readonly type: 'node.order.bringForward'; readonly ids: readonly NodeId[]; readonly before?: readonly NodeId[] }
  | { readonly type: 'node.order.sendBackward'; readonly ids: readonly NodeId[]; readonly before?: readonly NodeId[] }
  | { readonly type: 'edge.create'; readonly edge: Edge }
  | { readonly type: 'edge.update'; readonly id: EdgeId; readonly patch: EdgePatch; readonly before?: Edge }
  | { readonly type: 'edge.delete'; readonly id: EdgeId; readonly before?: Edge }
  | { readonly type: 'edge.order.set'; readonly ids: readonly EdgeId[]; readonly before?: readonly EdgeId[] }
  | { readonly type: 'edge.order.bringToFront'; readonly ids: readonly EdgeId[]; readonly before?: readonly EdgeId[] }
  | { readonly type: 'edge.order.sendToBack'; readonly ids: readonly EdgeId[]; readonly before?: readonly EdgeId[] }
  | { readonly type: 'edge.order.bringForward'; readonly ids: readonly EdgeId[]; readonly before?: readonly EdgeId[] }
  | { readonly type: 'edge.order.sendBackward'; readonly ids: readonly EdgeId[]; readonly before?: readonly EdgeId[] }
  | { readonly type: 'mindmap.create'; readonly mindmap: MindmapTree }
  | { readonly type: 'mindmap.replace'; readonly id: MindmapId; readonly before?: MindmapTree; readonly after: MindmapTree }
  | { readonly type: 'mindmap.delete'; readonly id: MindmapId; readonly before?: MindmapTree }
  | { readonly type: 'mindmap.node.create'; readonly id: MindmapId; readonly node: MindmapNode; readonly parentId: MindmapNodeId; readonly index?: number }
  | { readonly type: 'mindmap.node.update'; readonly id: MindmapId; readonly nodeId: MindmapNodeId; readonly patch: Partial<MindmapNode>; readonly before?: MindmapNode }
  | {
      readonly type: 'mindmap.node.delete'
      readonly id: MindmapId
      readonly nodeId: MindmapNodeId
      readonly parentId?: MindmapNodeId
      readonly index?: number
      readonly subtree: MindmapSubtree
    }
  | {
      readonly type: 'mindmap.node.move'
      readonly id: MindmapId
      readonly nodeId: MindmapNodeId
      readonly fromParentId: MindmapNodeId
      readonly toParentId: MindmapNodeId
      readonly fromIndex: number
      readonly toIndex: number
      readonly fromSide?: 'left' | 'right'
      readonly side?: 'left' | 'right'
    }
  | { readonly type: 'mindmap.node.reorder'; readonly id: MindmapId; readonly parentId: MindmapNodeId; readonly fromIndex: number; readonly toIndex: number }
  | { readonly type: 'viewport.update'; readonly before?: Viewport; readonly after: Viewport }

export interface ChangeSet {
  id: string
  timestamp: number
  operations: readonly Operation[]
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
    operations(operations: readonly Operation[], options?: CoreApplyOptions): DispatchResult
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
