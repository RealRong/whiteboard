import type { BoardConfig as EngineBoardConfig } from '@whiteboard/core/config'
import type {
  ContainerRect,
  ViewportLimits,
  WheelInput
} from '@whiteboard/core/geometry'
import type {
  ClipboardPacket,
} from '@whiteboard/core/document'
import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { SelectionInput, SelectionTarget } from '@whiteboard/core/selection'
import type { CommandResult, ReadStore } from '@whiteboard/engine'
import type {
  EdgeId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  Point,
  Size
} from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from './mindmap'
import type {
  BrushStylePatch,
  DrawSlot
} from './draw'
import type {
  InsertPresetKey,
  Tool
} from './tool'
import type { RuntimeRead } from '../runtime/read'
import type {
  ViewportCommands,
  ViewportRead
} from '../runtime/viewport'
import type { EditField, EditTarget } from '../runtime/state/edit'
import type { ShapeKind } from '@whiteboard/core/node'
import type { EditorOverlay } from '../runtime/overlay'
import type { NodeRegistry } from './node'
import type { EditorPick } from './pick'

type EngineCommands = import('@whiteboard/engine').EngineInstance['commands']
type EngineNodeCommands = EngineCommands['node']
type EngineMindmapCommands = EngineCommands['mindmap']

export type EditorClipboardTarget =
  | 'selection'
  | {
      nodeIds?: readonly NodeId[]
      edgeIds?: readonly EdgeId[]
    }

export type EditorClipboardOptions = {
  origin?: Point
  ownerId?: NodeId
}

export type EditorInsertResult = {
  nodeId: NodeId
  edit?: {
    nodeId: NodeId
    field: EditField
  }
}

export type EditorPointerSample = {
  client: Point
  screen: Point
  world: Point
}

export type EditorPointerInput = {
  pointerId: number
  button: number
  buttons: number
  detail: number
  client: Point
  screen: Point
  world: Point
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
  pick: EditorPick
  field?: EditField
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
  coalesced?: readonly EditorPointerSample[]
}

export type EditorKeyboardInput = {
  key: string
  code: string
  repeat: boolean
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export type EditorWheelInput = {
  deltaX: number
  deltaY: number
  ctrlKey: boolean
  metaKey: boolean
  client: Point
  screen: Point
  world: Point
}

export type EditorPointerDispatchResult = {
  handled: boolean
  continuePointer: boolean
}

export type EditorInput = {
  pointerDown: (input: EditorPointerInput) => EditorPointerDispatchResult
  pointerMove: (input: EditorPointerInput) => boolean
  pointerUp: (input: EditorPointerInput) => boolean
  pointerCancel: (input: {
    pointerId: number
  }) => boolean
  pointerLeave: () => void
  wheel: (input: EditorWheelInput) => boolean
  cancel: () => void
  keyDown: (input: EditorKeyboardInput) => boolean
  keyUp: (input: EditorKeyboardInput) => boolean
  blur: () => void
}

export type EditorState = {
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionTarget>
}

export type EditorFeedback = {
  draw: EditorOverlay['selectors']['feedback']['draw']
  edgeGuide: EditorOverlay['selectors']['feedback']['edgeGuide']
  marquee: EditorOverlay['selectors']['feedback']['marquee']
  mindmapDrag: EditorOverlay['selectors']['feedback']['mindmapDrag']
  snap: EditorOverlay['selectors']['feedback']['snap']
}

export type EditorRead = RuntimeRead
export type EditorViewport = ViewportRead & {
  input: {
    screenPoint: (clientX: number, clientY: number) => Point
    size: () => {
      width: number
      height: number
    }
    panScreenBy: (deltaScreen: Point) => void
    wheel: (input: WheelInput, wheelSensitivity: number) => void
  }
  setRect: (rect: ContainerRect) => void
  setLimits: (limits: ViewportLimits) => void
}

export type EditorInteractionState = Readonly<{
  busy: boolean
  chrome: boolean
  transforming: boolean
  drawing: boolean
  panning: boolean
  selecting: boolean
  editingEdge: boolean
  space: boolean
}>

export type EditorNodeDocumentCommands = {
  update: EngineNodeCommands['update']
  updateMany: EngineNodeCommands['updateMany']
}

export type EditorNodeLockCommands = {
  set: (nodeIds: readonly NodeId[], locked: boolean) => CommandResult
  toggle: (nodeIds: readonly NodeId[]) => CommandResult
}

export type EditorNodeTextCommands = {
  preview: (input: {
    nodeId: NodeId
    size: Size
  }) => void
  clearPreview: (nodeId: NodeId) => void
  cancel: (input: {
    nodeId: NodeId
  }) => void
  commit: (input: {
    nodeId: NodeId
    field: 'text' | 'title'
    value: string
    size?: Size
  }) => CommandResult | undefined
  setColor: (nodeIds: readonly NodeId[], color: string) => CommandResult
  setFontSize: (input: {
    nodeIds: readonly NodeId[]
    value?: number
    sizeById?: Readonly<Record<NodeId, Size>>
  }) => CommandResult
}

export type EditorNodeAppearanceCommands = {
  setFill: (nodeIds: readonly NodeId[], fill: string) => CommandResult
  setStroke: (nodeIds: readonly NodeId[], stroke: string) => CommandResult
  setStrokeWidth: (nodeIds: readonly NodeId[], width: number) => CommandResult
  setOpacity: (nodeIds: readonly NodeId[], opacity: number) => CommandResult
  setTextColor: (nodeIds: readonly NodeId[], color: string) => CommandResult
}

export type EditorNodeCommands = Omit<EngineNodeCommands, 'update' | 'updateMany'> & {
  document: EditorNodeDocumentCommands
  lock: EditorNodeLockCommands
  text: EditorNodeTextCommands
  appearance: EditorNodeAppearanceCommands
}

export type EditorMindmapCommands = EngineMindmapCommands & {
  insertByPlacement: (input: {
    id: NodeId
    tree: MindmapTree
    targetNodeId: MindmapNodeId
    placement: 'left' | 'right' | 'up' | 'down'
    nodeSize: Size
    layout: MindmapLayoutConfig
    payload?: MindmapNodeData
  }) => ReturnType<EngineMindmapCommands['insert']> | undefined
  moveByDrop: (input: {
    id: NodeId
    nodeId: MindmapNodeId
    drop: {
      parentId: MindmapNodeId
      index: number
      side?: 'left' | 'right'
    }
    origin?: {
      parentId?: MindmapNodeId
      index?: number
    }
    nodeSize: Size
    layout: MindmapLayoutConfig
  }) => ReturnType<EngineMindmapCommands['moveSubtree']> | undefined
  moveRoot: (input: {
    nodeId: NodeId
    position: Point
    origin?: Point
    threshold?: number
  }) => CommandResult | undefined
}

export type EditorCommands = Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport' | 'node' | 'mindmap'> & {
  tool: {
    set: (tool: Tool) => void
  }
  draw: {
    slot: (slot: DrawSlot) => void
    patch: (patch: BrushStylePatch) => void
  }
  edit: {
    start: (nodeId: NodeId, field: EditField) => void
    clear: () => void
  }
  selection: {
    replace: (input: SelectionInput) => void
    add: (input: SelectionInput) => void
    remove: (input: SelectionInput) => void
    toggle: (input: SelectionInput) => void
    selectAll: () => void
    clear: () => void
  }
  viewport: ViewportCommands
  edge: EngineCommands['edge']
  node: EditorNodeCommands
  mindmap: EditorMindmapCommands
  insert: {
    preset: (
      preset: InsertPresetKey,
      options: {
        at: Point
        ownerId?: NodeId
      }
    ) => EditorInsertResult | undefined
    text: (options: {
      at: Point
      ownerId?: NodeId
    }) => EditorInsertResult | undefined
    frame: (options: {
      at: Point
      ownerId?: NodeId
    }) => EditorInsertResult | undefined
    sticky: (options: {
      toneKey?: string
      at: Point
      ownerId?: NodeId
    }) => EditorInsertResult | undefined
    shape: (options: {
      kind: ShapeKind
      at: Point
      ownerId?: NodeId
    }) => EditorInsertResult | undefined
    mindmap: (options: {
      templateKey?: string
      at: Point
    }) => EditorInsertResult | undefined
  }
}

export type Editor = {
  interaction: {
    state: ReadStore<EditorInteractionState>
  }
  registry: NodeRegistry
  config: Readonly<EngineBoardConfig>
  read: EditorRead
  state: EditorState
  commands: EditorCommands
  clipboard: {
    export: (target?: EditorClipboardTarget) => ClipboardPacket | undefined
    cut: (target?: EditorClipboardTarget) => ClipboardPacket | undefined
    insert: (
      packet: ClipboardPacket,
      options?: EditorClipboardOptions
    ) => boolean
  }
  input: EditorInput
  viewport: EditorViewport
  feedback: EditorFeedback
  configure: (config: {
    tool: Tool
    viewport: {
      minZoom: number
      maxZoom: number
      enablePan: boolean
      enableWheel: boolean
      wheelSensitivity: number
    }
    mindmapLayout: MindmapLayoutConfig
    history?: KernelHistoryConfig
  }) => void
  dispose: () => void
}
