import {
  Box,
  EdgePosition,
  IWhiteboard,
  IWhiteboardAlignment,
  IWhiteboardEdge,
  IWhiteboardLayout,
  IWhiteboardNode,
  PartialWithId,
  XYPosition,
  IWhiteboardOutline,
  IWhiteboardMindmap
} from '~/typings'
import { CSSProperties, Dispatch, SetStateAction } from 'react'
import { ResizeDirection } from 're-resizable'
import { createStore } from 'jotai'
import { Patch } from 'immer'
import * as panzoom from 'panzoom'

export type IWhiteboardToolbarState = {
  // originX and originY is whiteboard coord, for scroll and move
  originX?: number
  originY?: number
  visible?: boolean
} & (
  | {
      type?: 'select'
    }
  | {
      type: 'edge'
      edgeId: number
    }
  | {
      type?: 'node'
      node: IWhiteboardNode
      openBy?: 'click' | 'contextMenu'
    }
  | {
      type: 'contextMenu'
    }
)

export type IWhiteboardTransform = { x: number; y: number; scale: number }

export type INodeInnerState = Partial<{
  selected: boolean
  focused: boolean
  isDragging: boolean
  name?: string
}>
export type IEdgeOverlayState = {
  isAdding?: boolean
  currentEdgeId?: number
  targetNodeId?: number
  sourceNodeId?: number
  targetPosition?: EdgePosition
  sourcePosition?: EdgePosition
  currentMousePosition?: XYPosition
  isReposition?: boolean
  repositionDirection?: 'source' | 'target'
}

export type IWhiteboardRightbarState = {
  visible: boolean
  // content is opened in sidebar
  active?: 'outline' | 'content'
  width: string
  currentTab?: {
    type: string
    metaId: number
    objectId: number
  }
}

export type ISetNodeInnerState = Dispatch<SetStateAction<INodeInnerState>>
export type INodeInnerFuncs = {
  // realtime box when being dragged / resized
  getRealtimeBox: () => Box | undefined
  select: VoidFunction
  deselect: VoidFunction
  setStyle: (newStyle: CSSProperties) => void
  getNodeState: () => INodeInnerState
  sizeAlreadyDefined: () => boolean
  // update node box when multi resizing node
  updateNodeBox: (newBox: Box) => void
  getNodeDOM: () => HTMLElement
  setNodeState: Dispatch<SetStateAction<INodeInnerState>>
  drawMindmapEdges?: VoidFunction
  focusText?: () => void
  onNodeCollapse?: (nodeIds: number[], collapse: boolean) => void
  onAddSubNode?: (sourceNodeId: number, newNode: IWhiteboardNode, idx: number, direction: 'right' | 'left') => void
}

export type IEdgeInnerFuncs = {
  edit: VoidFunction
  drawPath: VoidFunction
  transformEdge: (x: number, y: number) => void
  removeTransform: VoidFunction
}

export type IWhiteboardEvent =
  | ({
      type: 'drop'
    } & (
      | {
          itemType: 'file'
          file: File
        }
      | {
          itemType: 'object'
          metaId: number | number[]
        }
    ))
  | {
      type: 'nodeResized'
      resized: IWhiteboardNode[]
    }
  | {
      type: 'closeToolbar'
    }
  | {
      type: 'nodeDragStart'
      draggingNode: IWhiteboardNode
    }
  | {
      type: 'nodeDrag'
      draggingNode: IWhiteboardNode
      nodeElement: HTMLElement
      ignoreSnap?: boolean
      //  attachable mindmap child
      attachableNode?: {
        node: IWhiteboardNode
        direction: 'left' | 'right'
      }
      delta: {
        x: number
        y: number
      }
    }
  | {
      type: 'nodeResize'
      // pointer move box
      pointerBox: Box
      resizingNode: IWhiteboardNode
      nodeElement: HTMLElement
      resizeDir: ResizeDirection
      ignoreSnap?: boolean
      realtimeBox: Box
    }
  | {
      type: 'nodeResizeEnd'
    }
  | {
      type: 'nodeDragEnd'
      draggingNode: IWhiteboardNode
      //  attachable mindmap child
      attachableNode?: {
        node: IWhiteboardNode
        direction: 'left' | 'right'
      }
    }
  | {
      type: 'nodeResizeEnd'
    }
  | {
      type: 'nodeResizeStart'
      resizingNode: IWhiteboardNode
    }
  | {
      type: 'nodeSizeChange'
      changed: IWhiteboardNode[]
    }
  | {
      type: 'nodeDeleted'
      deleted: number[]
    }
  | {
      type: 'whiteboardUpdated'
      updated: IWhiteboardNode[]
      withUndo: boolean
    }
  | {
      type: 'nodeClick'
      node: IWhiteboardNode
    }
  | {
      type: 'panChange'
    }
  | {
      type: 'zoomChange'
    }
  | {
      type: 'keydown'
      e: KeyboardEvent
    }
  | {
      type: 'keyup'
      e: KeyboardEvent
    }
  | {
      type: 'pointerdown'
      e: PointerEvent
    }
  | {
      type: 'pointerup'
      e: PointerEvent
    }
  | {
      type: 'pointermove'
      e: PointerEvent
    }
  | {
      type: 'dataContainerClick'
      e: MouseEvent
    }
export type WhiteboardEvents = {
  [K in IWhiteboardEvent['type']]: Extract<IWhiteboardEvent, { type: K }>
}
export type IWhiteboardHistoryItem = {
  patches: Patch[]
  inversePatches: Patch[]
}
export type IWhiteboardInstance = Partial<{
  getNode: (nodeId: number) => IWhiteboardNode | undefined
  getAllNode: () => IWhiteboardNode[]
  getAllEdge: () => IWhiteboardEdge[]
  getEdge: (edgeId: number) => IWhiteboardEdge
  mindmapOps: {
    getFakeNodeBox: (nodeId: number) => Box | undefined
    updateMindmapEdges: (nodeId: number) => void
    expandMindmap: (node: IWhiteboardNode & { type: 'mindmap' }) => IWhiteboardNode[]
    startDragMindmapChild: (nodeId: number, e: PointerEvent) => void
  }
  getEdgeLayer: () => SVGGElement | null | undefined
  getEdgeLabelLayer: () => SVGGElement | null | undefined
  deleteNode: (nodeId: number) => void
  deleteEdge: (edgeId: number) => void
  deleteNodes: (nodeIds: number[]) => void
  insertMetasAtPointer: (e: PointerEvent, metas: number[]) => void
  insertNode: (node: Partial<IWhiteboardNode> | Partial<IWhiteboardNode>[]) => Promise<IWhiteboardNode[]>
  buildNodeToEdgeIndex: VoidFunction
  getTransform: () => {
    x: number
    y: number
    scale: number
  }
  historyOps: {
    redo: VoidFunction
    undo: VoidFunction
    pushUpdates: (item: IWhiteboardHistoryItem) => void
  }
  startResizeObserving: VoidFunction
  edgeOps: {
    endAction: VoidFunction
    getEdgeFuncs: (edgeId: number) => IEdgeInnerFuncs | undefined
    insertEdge: (e: Partial<IWhiteboardEdge>) => void
    startDrawEdge: (sourceNodeId: number) => void
    repositionEdge: (edgeId: number, direction: 'source' | 'target', mousePos: XYPosition) => void
    getEdgeOverlayState: () => IEdgeOverlayState
    setEdgeOverlayState: Dispatch<SetStateAction<IEdgeOverlayState>>
    hasEdge: (sourceNodeId: number, sourcePosition: EdgePosition, targetNodeId: number, targetPosition: EdgePosition) => boolean
  }
  sidebarOps: {
    openNodeAtSidebar: (nodeId: number) => void
  }
  containerOps: {
    getViewBox: () => Box
    fitToNode: (
      nodeId: number,
      opts?: {
        changeScale?: boolean
        maxScale?: number
        skipAnimation?: boolean
      }
    ) => void
    getInViewNodes: (fullyInView?: boolean) => IWhiteboardNode[]
    zoomTo: () => void
    // fit container to box
    fitTo: (
      box: Box,
      opts?: {
        changeScale?: boolean
        maxScale?: number
        skipAnimation?: boolean
      }
    ) => void
    fitToSelected: VoidFunction
    setTransform: (t: { x: number; y: number; scale: number }, skipAnimation?: boolean) => void
    moveBy: (x: number, y: number) => void
  }
  floatOps: {
    openNode: (nodeId: number) => void
  }
  contentOps: {
    transformToOutline: () => Record<string, IWhiteboardOutline[]>
  }
  moveToMetaNode: (
    metaId: number,
    opts?: {
      select?: boolean
    }
  ) => void
  nodeOps: {
    observe?: (element: HTMLElement) => void
    unobserve?: (element: HTMLElement) => void
    erase?: (id: number) => void
    getDOMBoxOfNodes: (ids: number | number[]) => Record<number, Box>
    getMaxZindex: () => number
    updateAfterZ: (currentNodeId: number) => void
    // return related nodes
    highlightRelatedEdgesAndNodes: (nodeId: number | number[]) => IWhiteboardNode[]
    getNodeFuncs: (nodeId: number) => INodeInnerFuncs | undefined
    deleteNode: (nodeId: number | number[], redo?: boolean) => void
    getNodeDOM: (nodeId: number) => HTMLElement
    fitContent: (nodeId: number | number[]) => void
    copy: (nodeId: number | number[]) => void
    // extend nodes like node inside group
    extendNodes: (currentNodes: number | number[] | IWhiteboardNode | IWhiteboardNode[]) => IWhiteboardNode[]
    paste: (position: XYPosition) => void
    // check if node intersect with another box
    intersectWith: (nodeId: number, box: Box) => boolean
    updateRelatedEdges: (nodeId: number | number[]) => void
    expand: (nodeId: number | number[]) => void
    fold: (nodeId: number | number[]) => void
    canExpand: (node: IWhiteboardNode) => node is IWhiteboardNode & { type: 'metaObject' }
    canOpenInSidePeekOrCenter: (nodeId: number) => boolean
    open: (nodeId: number, type: 'sidePeek' | 'newTab' | 'float') => void
  }
  updateEdge: (
    obj: PartialWithId<IWhiteboardEdge> | number,
    updater?: (curr: IWhiteboardEdge) => IWhiteboardEdge,
    withUndo?: boolean
  ) => Promise<void>
  updateNode: (
    obj: PartialWithId<IWhiteboardNode> | number,
    updater?: (curr: IWhiteboardNode) => IWhiteboardNode,
    withUndo?: boolean
  ) => Promise<void>
  // default spacing is 15, maybe to small?
  layoutOps: {
    alignNodes: (nodes: IWhiteboardNode[], alignment: IWhiteboardAlignment) => void
    layoutNodes: (nodes: IWhiteboardNode[], layout: IWhiteboardLayout, spacing?: number) => void
    packNodes: (nodes: IWhiteboardNode[], spacing?: number) => void
  }
  coordOps: {
    transformWindowPositionToPosition: (winPosition: XYPosition) => XYPosition
    transformWhiteboardPositionToWindowPosition: (position: XYPosition) => XYPosition
    transformWhiteboardRectToWindowRect: (box: Box) => Box
  }
  toolbarOps: {
    getToolbarState: () => IWhiteboardToolbarState
    closeToolbar: VoidFunction
    // pos are all whiteboard coord
    openNodeToolbar: (nodeId: number, position: XYPosition, openBy?: 'click' | 'contextMenu') => void
    openSelectToolbar: (position: XYPosition) => void
    openEdgeToolbar: (edgeId: number, position: XYPosition) => void
    openContextMenuToolbar: (position: XYPosition) => void
    selectPasteOption: (position: XYPosition) => Promise<'text' | 'image' | 'nodes' | 'objects'>
  }
  searchOps: {
    toggleSearchPanel: (visible?: boolean) => void
  }
  groupOps: {
    expandGroups: VoidFunction
    getParentGroupsOfNode: (nodeId: number, mindmapChildUseRoot?: boolean) => IWhiteboardNode[]
    getNodesInGroup: (groupNodeId: number, includeSelf?: boolean, mindmapChildUseRoot?: boolean) => IWhiteboardNode[]
    groupNodes: (nodeId: number | number[]) => void
    exportGroupImage: (groupId: number) => void
  }
  groupNodes: (nodes: IWhiteboardNode[]) => void
  selectOps: {
    // reset selection box after align or distribute spacing
    resetSelectionBox: VoidFunction
    getSelectedNodes: () => IWhiteboardNode[]
    selectNode: (nodeId: number | number[], setState?: boolean) => void
    deselectNode: (nodeId: number | number[]) => void
    hasSelectedNodes: () => boolean
    // remove pointer draw selection box, but do not deselect all
    removeSelectionBox: VoidFunction
    // remove selection box, and deselect all nodes
    deselectAll: (skip?: number | number[]) => void
    isSelecting: () => boolean
  }
}> & {
  setFocused: (f: boolean) => void
  isFocused: (includeInner?: boolean) => boolean
  getContainerNode: () => HTMLElement
  getOutestContainerNode: () => HTMLElement | null | undefined
  updateWhiteboard: (updater: (curr: IWhiteboard) => void, withUndo?: boolean) => Promise<void>
  emit: (e: IWhiteboardEvent) => void
  addEventListener: <K extends keyof WhiteboardEvents>(type: K, listener: (e: WhiteboardEvents[K]) => void) => void
  removeEventListener: <K extends keyof WhiteboardEvents>(type: K, listener: (e: WhiteboardEvents[K]) => void) => void
  panzoom?: panzoom.PanZoom & {
    setTransform: (
      t: {
        x: number
        y: number
        scale: number
      },
      duration: number | undefined,
      skip: boolean | undefined
    ) => void
  }
  values: {
    store: ReturnType<typeof createStore>
    id?: number
    isFocused: boolean
    mindmapAttachableNodesCache?: IWhiteboardNode[]
    // need this to prevent resizeobserver update height loop.
    isResizingSelectionBox?: boolean
    currentDraggingNodeId?: number
    copiedElements: IWhiteboardNode[]
    mindmapChildrenToFlattenChildren: WeakMap<IWhiteboardMindmap[], IWhiteboardMindmap[]>
    mindmapRightTreeWeakMap: WeakMap<IWhiteboardNode, Map<number, IWhiteboardMindmap>>
    mindmapLeftTreeWeakMap: WeakMap<IWhiteboardNode, Map<number, IWhiteboardMindmap>>
    // select box when use pointer
    selectBox?: Box
    // inner node to related edge set map
    NODE_TO_EDGE_MAP: Map<number, Set<number>>
    // inner edge id to function map
    ID_TO_EDGE_MAP: Map<number, IEdgeInnerFuncs>
    // inner node id to function map
    ID_TO_NODE_MAP: Map<number, INodeInnerFuncs>
  }
}
