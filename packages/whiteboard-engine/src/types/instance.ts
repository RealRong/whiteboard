import type { InstanceConfig } from '@whiteboard/core/config'
import type { MindmapLayoutConfig } from '@whiteboard/core/mindmap'
import type {
  CanvasNodeRect,
  EdgeEntry,
  MindmapViewTree,
  NodeViewItem
} from '@whiteboard/core/read'
import type { CoreRegistries, Document, EdgeAnchor, EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type {
  KeyedReadStore,
  ReadStore
} from '@whiteboard/core/runtime'
import type { Commands } from './command'
import type { ResolvedHistoryConfig, Size } from './common'
import type { SnapCandidate } from './node'
export type { InstanceConfig } from '@whiteboard/core/config'

export type EdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}
export type EngineReadIndex = {
  node: {
    all: () => CanvasNodeRect[]
    byId: (nodeId: NodeId) => CanvasNodeRect | undefined
    idsInRect: (rect: Rect) => NodeId[]
  }
  snap: {
    all: () => SnapCandidate[]
    inRect: (rect: Rect) => SnapCandidate[]
  }
  tree: {
    ids: (nodeId: NodeId) => readonly NodeId[]
    has: (rootId: NodeId, nodeId: NodeId) => boolean
  }
}

export type NodeRead = {
  ids: ReadStore<readonly NodeId[]>
  byId: KeyedReadStore<NodeId, Readonly<NodeViewItem> | undefined>
}

export type EdgeRead = {
  ids: ReadStore<readonly EdgeId[]>
  byId: KeyedReadStore<EdgeId, Readonly<EdgeEntry> | undefined>
}

export type MindmapRead = {
  ids: ReadStore<readonly NodeId[]>
  byId: KeyedReadStore<NodeId, Readonly<MindmapViewTree> | undefined>
}

export type TreeRead = KeyedReadStore<NodeId, readonly NodeId[]>

export type EngineRead = {
  node: NodeRead
  edge: EdgeRead
  mindmap: MindmapRead
  tree: TreeRead
  index: EngineReadIndex
}

export type RuntimeConfig = {
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type Instance = {
  config: Readonly<InstanceConfig>
  read: EngineRead
  commands: Commands
  configure: (config: RuntimeConfig) => void
  dispose: () => void
}

export type EngineDocument = {
  get: () => Document
  commit: (doc: Document) => void
}

export type CreateEngineOptions = {
  registries?: CoreRegistries
  /**
   * Engine treats document input as immutable data.
   * Replacing or loading with the same document reference is unsupported.
   */
  document: Document
  onDocumentChange?: (doc: Document) => void
  config?: Partial<InstanceConfig>
}
