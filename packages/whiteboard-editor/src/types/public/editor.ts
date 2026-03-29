import type { BoardConfig as EngineBoardConfig } from '@whiteboard/core/config'
import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
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
import type { MindmapLayoutConfig } from '../mindmap'
import type { SelectionInput, SelectionTarget } from '../internal/selection'
import type {
  BrushStylePatch,
  DrawSlot
} from './draw'
import type {
  DrawKind,
  EdgePresetKey,
  InsertPresetKey,
  Tool
} from './tool'
import type { RuntimeRead } from '../../runtime/read'
import type { FrameScope } from '../../runtime/frame'
import type {
  ViewportCommands,
  ViewportRead
} from '../../runtime/viewport'
import type {
  ClipboardPort
} from '../../runtime/host/clipboard'
import type { DocumentSelectionLock } from '../../runtime/host/selectionLock'
import type { PointerContinuation } from '../../runtime/host/pointerContinuation'
import type { EditField, EditTarget } from '../../runtime/edit'
import type { ShapeKind } from '../../features/node/shape'
import type {
  ContextDismissMode,
  ContextOpenInput
} from './context'
import type { DrawInputRuntime } from '../../features/draw/input'
import type { EdgeProjection } from '../../features/edge/projection'
import type { MindmapDragProjectionStore } from '../../features/mindmap/drag/projection'
import type { MarqueeSession } from '../../features/selection/marquee'
import type { SnapRuntime } from '../../runtime/interaction'

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
  event?: ClipboardEvent
  at?: Point
  ownerId?: NodeId
}

export type EditorInsertResult = {
  nodeId: NodeId
  edit?: {
    nodeId: NodeId
    field: EditField
  }
}

export type EditorPointerInput = {
  container: HTMLDivElement
  event: PointerEvent
}

export type EditorKeyboardInput = {
  event: KeyboardEvent
}

export type EditorWheelInput = {
  deltaX: number
  deltaY: number
  ctrlKey: boolean
  metaKey: boolean
  clientX: number
  clientY: number
}

export type EditorInput = {
  pointerDown: (input: EditorPointerInput) => boolean
  pointerMove: (input: EditorPointerInput) => void
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
  frame: ReadStore<FrameScope>
}

export type EditorProjection = {
  marquee: Pick<MarqueeSession, 'rect' | 'match'>
  draw: Pick<DrawInputRuntime['preview'], 'get' | 'subscribe'>
  edge: {
    patch: Pick<EdgeProjection['patch'], 'get' | 'subscribe'>
    hint: Pick<EdgeProjection['hint'], 'get' | 'subscribe'>
    emptyPatch: EdgeProjection['emptyPatch']
  }
  mindmapDrag: Pick<MindmapDragProjectionStore, 'get' | 'subscribe'>
  snap: SnapRuntime['node']['guides']
}

export type EditorRead = RuntimeRead
export type EditorViewport = ViewportRead

export type EditorPlatformBridge = {
  clipboard?: ClipboardPort
  selectionLock?: DocumentSelectionLock
  pointerContinuation?: PointerContinuation
}

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
    value: string
    source: HTMLElement
  }) => void
  clearPreview: (nodeId: NodeId) => void
  cancel: (input: {
    nodeId: NodeId
  }) => void
  commit: (input: {
    nodeId: NodeId
    field: 'text' | 'title'
    value: string
    source?: HTMLElement
    measuredSize?: Size
  }) => CommandResult | undefined
  setColor: (nodeIds: readonly NodeId[], color: string) => CommandResult
  setFontSize: (input: {
    nodeIds: readonly NodeId[]
    field?: 'text' | 'title'
    value?: number
    measuredSizeById?: Readonly<Record<NodeId, Size>>
    sourceById?: Readonly<Record<NodeId, HTMLElement | undefined>>
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
    select: () => void
    hand: () => void
    edge: (preset?: EdgePresetKey) => void
    insert: (preset: InsertPresetKey) => void
    draw: (kind?: DrawKind) => void
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
  frame: {
    enter: (nodeId: NodeId) => void
    exit: () => void
    clear: () => void
  }
  viewport: ViewportCommands
  edge: EngineCommands['edge']
  node: EditorNodeCommands
  mindmap: EditorMindmapCommands
  context: {
    open: (input: ContextOpenInput) => boolean
    dismiss: (mode: ContextDismissMode) => void
  }
  clipboard: {
    copy: (
      target?: EditorClipboardTarget,
      options?: Pick<EditorClipboardOptions, 'event'>
    ) => Promise<boolean>
    cut: (
      target?: EditorClipboardTarget,
      options?: Pick<EditorClipboardOptions, 'event'>
    ) => Promise<boolean>
    paste: (options?: EditorClipboardOptions) => Promise<boolean>
  }
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
  config: Readonly<EngineBoardConfig>
  read: EditorRead
  state: EditorState
  commands: EditorCommands
  input: EditorInput
  viewport: EditorViewport
  projection: EditorProjection
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
