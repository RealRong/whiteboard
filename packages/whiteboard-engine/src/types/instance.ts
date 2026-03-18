import type { BoardConfig } from '@whiteboard/core/config'
import type { MindmapLayoutConfig } from '@whiteboard/core/mindmap'
import type {
  CanvasNode,
  EdgeItem,
  MindmapItem,
  NodeItem
} from '@whiteboard/core/read'
import type { CoreRegistries, Document, EdgeAnchor, EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type {
  KeyedReadStore,
  ReadStore
} from '@whiteboard/core/runtime'
import type { EngineCommands } from './command'
import type { ResolvedHistoryConfig, Size } from './common'
import type { SnapCandidate } from './node'
import type { Commit } from './commit'
export type { BoardConfig } from '@whiteboard/core/config'

export type EdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}
export type EngineReadIndex = {
  node: {
    all: () => CanvasNode[]
    get: (nodeId: NodeId) => CanvasNode | undefined
    idsInRect: (rect: Rect) => NodeId[]
  }
  snap: {
    all: () => SnapCandidate[]
    inRect: (rect: Rect) => SnapCandidate[]
  }
  tree: {
    list: (nodeId: NodeId) => readonly NodeId[]
    has: (rootId: NodeId, nodeId: NodeId) => boolean
  }
}

export type NodeRead = {
  list: ReadStore<readonly NodeId[]>
  item: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
}

export type EdgeRead = {
  list: ReadStore<readonly EdgeId[]>
  item: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
}

export type MindmapRead = {
  list: ReadStore<readonly NodeId[]>
  item: KeyedReadStore<NodeId, Readonly<MindmapItem> | undefined>
}

export type TreeRead = KeyedReadStore<NodeId, readonly NodeId[]>

export type EngineRead = {
  node: NodeRead
  edge: EdgeRead
  mindmap: MindmapRead
  tree: TreeRead
  index: EngineReadIndex
}

export type EngineRuntimeOptions = {
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type EngineInstance = {
  config: Readonly<BoardConfig>
  read: EngineRead
  commit: ReadStore<Commit | null>
  commands: EngineCommands
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
