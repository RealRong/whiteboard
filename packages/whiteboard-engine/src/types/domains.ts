import type { EdgeId, MindmapId, NodeId, Point } from '@whiteboard/core/types'
import type { Commands } from './commands'
import type { InputSessionContext } from './input'
import type { Query } from './instance/query'
import type { State } from './instance/state'
import type {
  EdgePathEntry,
  EdgesView,
  MindmapView,
  MindmapViewTree,
  NodeViewItem,
  NodesView,
  ViewportView
} from './instance/view'
import type { SelectionMode, SelectionState } from './state'

type DomainSubscribe = (listener: () => void) => () => void
type BindFirst<T> = T extends (first: any, ...rest: infer TRest) => infer TResult
  ? (...rest: TRest) => TResult
  : never

export type NodeDomainApi = {
  commands: {
    create: Commands['node']['create']
    update: Commands['node']['update']
    updateData: Commands['node']['updateData']
    updateManyPosition: Commands['node']['updateManyPosition']
    delete: Commands['node']['delete']
    order: Commands['order']['node']
    group: Commands['group']
  }
  interaction: {
    drag: InputSessionContext['nodeInput']['drag']
    transform: InputSessionContext['nodeInput']['transform']
  }
  query: {
    rects: Query['canvas']['nodeRects']
    rect: Query['canvas']['nodeRect']
    idsInRect: Query['canvas']['nodeIdsInRect']
  }
  view: {
    get: () => NodesView
    getById: (id: NodeId) => NodeViewItem | undefined
    subscribe: DomainSubscribe
  }
}

export type EdgeDomainApi = {
  commands: {
    create: Commands['edge']['create']
    update: Commands['edge']['update']
    delete: Commands['edge']['delete']
    insertRoutingPoint: Commands['edge']['insertRoutingPoint']
    moveRoutingPoint: Commands['edge']['moveRoutingPoint']
    removeRoutingPoint: Commands['edge']['removeRoutingPoint']
    resetRouting: Commands['edge']['resetRouting']
    select: Commands['edge']['select']
    order: Commands['order']['edge']
  }
  interaction: {
    routing: InputSessionContext['edgeInput']['routing']
  }
  query: {
    nearestSegment: Query['geometry']['nearestEdgeSegment']
  }
  view: {
    get: () => EdgesView
    getById: (id: EdgeId) => EdgePathEntry | undefined
    subscribe: DomainSubscribe
  }
}

export type MindmapDomainApi = {
  commands: Commands['mindmap']
  interaction: {
    drag: InputSessionContext['mindmapInput']['drag']
  }
  query: {
    getTree: (id: MindmapId) => MindmapViewTree | undefined
  }
  view: {
    get: () => MindmapView
    subscribe: DomainSubscribe
  }
}

export type SelectionDomainApi = {
  commands: Commands['selection']
  interaction: {
    box: InputSessionContext['selectionInput']['box']
  }
  query: {
    get: () => SelectionState
    getSelectedNodeIds: () => NodeId[]
    getSelectedEdgeId: () => EdgeId | undefined
    getMode: () => SelectionMode
  }
  view: {
    getEdgeSelection: () => EdgesView['selection']
    subscribe: DomainSubscribe
  }
}

export type ViewportDomainApi = {
  commands: Commands['viewport']
  interaction: {
    setSpacePressed: Commands['keyboard']['setSpacePressed']
  }
  query: Query['viewport']
  view: {
    get: () => ViewportView
    subscribe: DomainSubscribe
  }
}

export type DomainApis = {
  node: NodeDomainApi
  edge: EdgeDomainApi
  mindmap: MindmapDomainApi
  selection: SelectionDomainApi
  viewport: ViewportDomainApi
}

type NodeDragBeginInput = Parameters<InputSessionContext['nodeInput']['drag']['begin']>[0]
type NodeResizeStartInput = Parameters<InputSessionContext['nodeInput']['transform']['beginResize']>[0]
type NodeRotateStartInput = Parameters<InputSessionContext['nodeInput']['transform']['beginRotate']>[0]
type MindmapInsertNodeInput = Parameters<Commands['mindmap']['insertNode']>[0]
type MindmapMoveSubtreeWithLayoutInput = Parameters<Commands['mindmap']['moveSubtreeWithLayout']>[0]
type MindmapMoveSubtreeWithDropInput = Parameters<Commands['mindmap']['moveSubtreeWithDrop']>[0]

export type NodeEntityApi = {
  id: NodeId
  commands: {
    update: (patch: Parameters<Commands['node']['update']>[1]) => ReturnType<Commands['node']['update']>
    updateData: (patch: Parameters<Commands['node']['updateData']>[1]) => ReturnType<Commands['node']['updateData']>
    delete: () => ReturnType<Commands['node']['delete']>
    bringToFront: () => ReturnType<Commands['order']['node']['bringToFront']>
    sendToBack: () => ReturnType<Commands['order']['node']['sendToBack']>
    bringForward: () => ReturnType<Commands['order']['node']['bringForward']>
    sendBackward: () => ReturnType<Commands['order']['node']['sendBackward']>
  }
  interaction: {
    drag: {
      begin: (options: Omit<NodeDragBeginInput, 'nodeId'>) => ReturnType<InputSessionContext['nodeInput']['drag']['begin']>
      updateDraft: InputSessionContext['nodeInput']['drag']['updateDraft']
      commitDraft: InputSessionContext['nodeInput']['drag']['commitDraft']
      cancelDraft: InputSessionContext['nodeInput']['drag']['cancelDraft']
    }
    transform: {
      beginResize: (options: Omit<NodeResizeStartInput, 'nodeId'>) => ReturnType<InputSessionContext['nodeInput']['transform']['beginResize']>
      beginRotate: (options: Omit<NodeRotateStartInput, 'nodeId'>) => ReturnType<InputSessionContext['nodeInput']['transform']['beginRotate']>
      updateDraft: InputSessionContext['nodeInput']['transform']['updateDraft']
      commitDraft: InputSessionContext['nodeInput']['transform']['commitDraft']
      cancelDraft: InputSessionContext['nodeInput']['transform']['cancelDraft']
    }
  }
  query: {
    rect: () => ReturnType<Query['canvas']['nodeRect']>
    view: () => NodeViewItem | undefined
  }
}

export type EdgeEntityApi = {
  id: EdgeId
  commands: {
    update: (patch: Parameters<Commands['edge']['update']>[1]) => ReturnType<Commands['edge']['update']>
    delete: () => ReturnType<Commands['edge']['delete']>
    select: () => void
    unselect: () => void
    insertRoutingPointAt: (pointWorld: Point) => ReturnType<InputSessionContext['edgeInput']['routing']['insertRoutingPointAt']>
    removeRoutingPointAt: (index: number) => ReturnType<InputSessionContext['edgeInput']['routing']['removeRoutingPointAt']>
    resetRouting: () => void
    bringToFront: () => ReturnType<Commands['order']['edge']['bringToFront']>
    sendToBack: () => ReturnType<Commands['order']['edge']['sendToBack']>
    bringForward: () => ReturnType<Commands['order']['edge']['bringForward']>
    sendBackward: () => ReturnType<Commands['order']['edge']['sendBackward']>
  }
  interaction: {
    routing: {
      begin: (index: number, pointer: Parameters<InputSessionContext['edgeInput']['routing']['begin']>[0]['pointer']) => ReturnType<InputSessionContext['edgeInput']['routing']['begin']>
      updateDraft: InputSessionContext['edgeInput']['routing']['updateDraft']
      commitDraft: InputSessionContext['edgeInput']['routing']['commitDraft']
      cancelDraft: InputSessionContext['edgeInput']['routing']['cancelDraft']
    }
  }
  query: {
    view: () => EdgePathEntry | undefined
  }
}

export type MindmapEntityApi = {
  id: MindmapId
  commands: {
    replace: BindFirst<Commands['mindmap']['replace']>
    delete: () => ReturnType<Commands['mindmap']['delete']>
    addChild: BindFirst<Commands['mindmap']['addChild']>
    addSibling: BindFirst<Commands['mindmap']['addSibling']>
    moveSubtree: BindFirst<Commands['mindmap']['moveSubtree']>
    removeSubtree: BindFirst<Commands['mindmap']['removeSubtree']>
    cloneSubtree: BindFirst<Commands['mindmap']['cloneSubtree']>
    toggleCollapse: BindFirst<Commands['mindmap']['toggleCollapse']>
    setNodeData: BindFirst<Commands['mindmap']['setNodeData']>
    reorderChild: BindFirst<Commands['mindmap']['reorderChild']>
    setSide: BindFirst<Commands['mindmap']['setSide']>
    attachExternal: BindFirst<Commands['mindmap']['attachExternal']>
    insertNode: (options: Omit<MindmapInsertNodeInput, 'id'>) => ReturnType<Commands['mindmap']['insertNode']>
    moveSubtreeWithLayout: (options: Omit<MindmapMoveSubtreeWithLayoutInput, 'id'>) => ReturnType<Commands['mindmap']['moveSubtreeWithLayout']>
    moveSubtreeWithDrop: (options: Omit<MindmapMoveSubtreeWithDropInput, 'id'>) => ReturnType<Commands['mindmap']['moveSubtreeWithDrop']>
  }
  interaction: {
    drag: {
      start: (nodeId: Parameters<InputSessionContext['mindmapInput']['drag']['start']>[1], pointer: Parameters<InputSessionContext['mindmapInput']['drag']['start']>[2]) => ReturnType<InputSessionContext['mindmapInput']['drag']['start']>
      update: InputSessionContext['mindmapInput']['drag']['update']
      end: InputSessionContext['mindmapInput']['drag']['end']
      cancel: InputSessionContext['mindmapInput']['drag']['cancel']
    }
  }
  query: {
    tree: () => MindmapViewTree | undefined
  }
}

export type DomainEntityApis = {
  node: (id: NodeId) => NodeEntityApi
  edge: (id: EdgeId) => EdgeEntityApi
  mindmap: (id: MindmapId) => MindmapEntityApi
}

export type SelectionStateReader = Pick<State, 'read'>
