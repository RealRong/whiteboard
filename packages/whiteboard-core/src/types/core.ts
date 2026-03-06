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

// Operation is immutable once created. Any enrichment or normalization must
// return a new operation instead of mutating an existing one.
export type Operation =
  | { readonly type: 'node.create'; readonly node: Node }
  | { readonly type: 'node.update'; readonly id: NodeId; readonly patch: NodePatch; readonly before?: Node }
  | { readonly type: 'node.delete'; readonly id: NodeId; readonly before?: Node }
  | { readonly type: 'node.order.set'; readonly ids: readonly NodeId[]; readonly before?: readonly NodeId[] }
  | { readonly type: 'edge.create'; readonly edge: Edge }
  | { readonly type: 'edge.update'; readonly id: EdgeId; readonly patch: EdgePatch; readonly before?: Edge }
  | { readonly type: 'edge.delete'; readonly id: EdgeId; readonly before?: Edge }
  | { readonly type: 'edge.order.set'; readonly ids: readonly EdgeId[]; readonly before?: readonly EdgeId[] }
  | { readonly type: 'mindmap.set'; readonly id: MindmapId; readonly tree: MindmapTree; readonly before?: MindmapTree }
  | { readonly type: 'mindmap.delete'; readonly id: MindmapId; readonly before?: MindmapTree }
  | { readonly type: 'viewport.update'; readonly before?: Viewport; readonly after: Viewport }

export interface ChangeSet {
  id: string
  timestamp: number
  operations: readonly Operation[]
  origin?: 'user' | 'remote' | 'system'
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
}

export type DispatchResult = DispatchSuccess | DispatchFailure
