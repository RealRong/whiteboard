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

export type EntityCollection<TId extends string, T extends { id: TId }> = {
  entities: Record<TId, T>
  order: TId[]
}

export interface Document {
  id: DocumentId
  name?: string
  nodes: EntityCollection<NodeId, Node>
  edges: EntityCollection<EdgeId, Edge>
  background?: { type: 'dot' | 'line' | 'none'; color?: string }
  viewport?: Viewport
  meta?: { createdAt?: string; updatedAt?: string }
}

const toOrderedItems = <TId extends string, T extends { id: TId }>(
  collection: EntityCollection<TId, T>
): T[] => {
  if (!collection.order.length) {
    return Object.values(collection.entities) as T[]
  }

  const ordered: T[] = []
  const visited = new Set<TId>()

  collection.order.forEach((id) => {
    const item = collection.entities[id]
    if (!item) return
    ordered.push(item)
    visited.add(id)
  })

  for (const item of Object.values(collection.entities) as T[]) {
    if (visited.has(item.id)) continue
    ordered.push(item)
  }

  return ordered
}

export const createDocument = (id: DocumentId): Document => ({
  id,
  nodes: {
    entities: {},
    order: []
  },
  edges: {
    entities: {},
    order: []
  }
})

export const getNode = (
  document: Pick<Document, 'nodes'>,
  id: NodeId
): Node | undefined => document.nodes.entities[id]

export const getEdge = (
  document: Pick<Document, 'edges'>,
  id: EdgeId
): Edge | undefined => document.edges.entities[id]

export const hasNode = (
  document: Pick<Document, 'nodes'>,
  id: NodeId
): boolean => Boolean(document.nodes.entities[id])

export const hasEdge = (
  document: Pick<Document, 'edges'>,
  id: EdgeId
): boolean => Boolean(document.edges.entities[id])

export const listNodes = (
  document: Pick<Document, 'nodes'>
): Node[] => toOrderedItems(document.nodes)

export const listEdges = (
  document: Pick<Document, 'edges'>
): Edge[] => toOrderedItems(document.edges)

const hasOwn = (target: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(target, key)

const assertEntityCollection = <TId extends string, T extends { id: TId }>(
  name: string,
  collection: EntityCollection<TId, T>
) => {
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) {
    throw new Error(`Document ${name} must be an entity collection.`)
  }

  if (!collection.entities || typeof collection.entities !== 'object' || Array.isArray(collection.entities)) {
    throw new Error(`Document ${name}.entities must be a record.`)
  }

  if (!Array.isArray(collection.order)) {
    throw new Error(`Document ${name}.order must be an array.`)
  }

  for (const id of collection.order) {
    if (typeof id !== 'string') {
      throw new Error(`Document ${name}.order must contain string ids.`)
    }
    if (!hasOwn(collection.entities, id)) {
      throw new Error(`Document ${name}.order contains missing entity ${id}.`)
    }
  }

  for (const [id, entity] of Object.entries(collection.entities) as Array<[TId, T]>) {
    if (!entity || typeof entity !== 'object') {
      throw new Error(`Document ${name}.entities.${id} must be an object.`)
    }
    if (entity.id !== id) {
      throw new Error(`Document ${name}.entities.${id} has mismatched entity id.`)
    }
  }
}

export const assertDocument = (document: Document): Document => {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Document must be an object.')
  }

  if (typeof document.id !== 'string' || !document.id) {
    throw new Error('Document id is required.')
  }

  assertEntityCollection('nodes', document.nodes)
  assertEntityCollection('edges', document.edges)

  return document
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
