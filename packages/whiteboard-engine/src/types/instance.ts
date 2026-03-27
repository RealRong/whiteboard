import type { BoardConfig } from '@whiteboard/core/config'
import type { MindmapLayoutConfig } from '@whiteboard/core/mindmap'
import type { SliceExportResult } from '@whiteboard/core/document'
import type {
  CanvasNode,
  EdgeItem,
  MindmapItem,
  NodeItem
} from './projection'
import type { HistoryConfig } from '@whiteboard/core/kernel'
import type { SnapCandidate } from '@whiteboard/core/node'
import type {
  NodeRectHitOptions,
  TargetBoundsInput,
  TransformSelectionTargets
} from '@whiteboard/core/node'
import type {
  CoreRegistries,
  Document,
  EdgeId,
  Node,
  NodeId,
  Operation,
  Point,
  Rect
} from '@whiteboard/core/types'
import type {
  KeyedReadStore,
  ReadStore
} from './store'
import type { EngineCommands } from './command'
import type { Commit } from './commit'
import type { CommandResult } from './result'
export type { BoardConfig } from '@whiteboard/core/config'

export type ApplyOperationsOptions = {
  origin?: 'user' | 'system' | 'remote'
}

export type EngineReadIndex = {
  node: {
    all: () => CanvasNode[]
    get: (nodeId: NodeId) => CanvasNode | undefined
    idsInRect: (rect: Rect, options?: NodeRectHitOptions) => NodeId[]
  }
  snap: {
    all: () => SnapCandidate[]
    inRect: (rect: Rect) => SnapCandidate[]
  }
}

export type NodeRead = {
  list: ReadStore<readonly NodeId[]>
  item: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  owner: (nodeId: NodeId) => NodeId | undefined
  bounds: (nodeId: NodeId) => Rect | undefined
  frame: (nodeId: NodeId) => Rect | undefined
  frameAt: (point: Point) => NodeId | undefined
  idsInRect: (rect: Rect, options?: NodeRectHitOptions) => NodeId[]
  transformTargets: (
    nodeIds: readonly NodeId[]
  ) => TransformSelectionTargets<Node> | undefined
}

export type EdgeRead = {
  list: ReadStore<readonly EdgeId[]>
  item: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  related: (nodeIds: Iterable<NodeId>) => readonly EdgeId[]
}

export type MindmapRead = {
  list: ReadStore<readonly NodeId[]>
  item: KeyedReadStore<NodeId, Readonly<MindmapItem> | undefined>
}

export type TreeRead = KeyedReadStore<NodeId, readonly NodeId[]>

export type SliceRead = {
  fromNodes: (nodeIds: readonly NodeId[]) => SliceExportResult | undefined
  fromEdge: (edgeId: EdgeId) => SliceExportResult | undefined
  fromSelection: (selection: {
    nodeIds?: readonly NodeId[]
    edgeIds?: readonly EdgeId[]
  }) => SliceExportResult | undefined
}

export type BoundsRead = {
  canvas: () => Rect | undefined
  targets: (input: TargetBoundsInput) => Rect | undefined
}

export type EngineRead = {
  document: {
    background: ReadStore<Document['background'] | undefined>
  }
  bounds: BoundsRead
  node: NodeRead
  edge: EdgeRead
  mindmap: MindmapRead
  tree: TreeRead
  slice: SliceRead
  index: EngineReadIndex
}

export type EngineRuntimeOptions = {
  mindmapLayout: MindmapLayoutConfig
  history?: Partial<HistoryConfig>
}

export type EngineInstance = {
  config: Readonly<BoardConfig>
  document: {
    get: () => Document
  }
  read: EngineRead
  commit: ReadStore<Commit | null>
  commands: EngineCommands
  applyOperations: (
    operations: readonly Operation[],
    options?: ApplyOperationsOptions
  ) => CommandResult
  configure: (config: EngineRuntimeOptions) => void
  dispose: () => void
}

export type EngineDocument = {
  get: () => Document
  commit: (document: Document) => void
}

export type CreateEngineOptions = {
  registries?: CoreRegistries
  /**
   * Engine treats document input as immutable data.
   * Replacing or loading with the same document reference is unsupported.
   */
  document: Document
  onDocumentChange?: (document: Document) => void
  config?: Partial<BoardConfig>
}
