import type { BoardConfig as EngineBoardConfig } from '@whiteboard/core/config'
import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { ReadStore } from '@whiteboard/engine'
import type { CommandResult } from '@whiteboard/engine'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  EngineInstance
} from '@whiteboard/engine'
import type { Point, Size } from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from '../../types/mindmap'
import type { RuntimeRead } from '../read'
import type {
  FrameScope
} from '../frame'
import type {
  SelectionInput,
  SelectionTarget
} from '../selection'
import type {
  ViewportCommands,
  ViewportRead
} from '../viewport'
import type { ViewportRuntime } from '../viewport/createViewport'
import type { NodeRegistry } from '../../types/node'
import type {
  InteractionCoordinator,
  InteractionState
} from '../interaction/types'
import type { SnapRuntime } from '../interaction/snap'
import type {
  ClipboardPort,
  ClipboardRuntime
} from '../host/clipboard'
import type { DocumentSelectionLock } from '../host/selectionLock'
import type { PointerContinuation } from '../host/pointerContinuation'
import type { NodeFeatureRuntime } from '../../features/node/session/node'
import type { EdgePreview } from '../../features/edge/preview'
import type { MindmapDragStore } from '../../features/mindmap/session/drag'
import type { MindmapDragController } from '../../features/mindmap/dragSession'
import type {
  DrawKind,
  EdgePresetKey,
  InsertPresetKey,
  Tool
} from '../tool'
import type { EditField, EditTarget } from '../edit'
import type {
  BrushStylePatch,
  DrawSlot,
  DrawPreferences
} from '../../features/draw/state'
import type { PickRuntime } from '../pick'
import type { ShapeKind } from '../../features/node/shape'
import type { SelectionGesture } from '../../features/selection/gesture'
import type { MarqueeSession } from '../../features/selection/marquee'
import type { EdgeConnectSession } from '../../features/edge/connectSession'
import type { NodeTransformSession } from '../../features/node/session/transform'
import type { MindmapNodeData, MindmapNodeId, MindmapTree } from '@whiteboard/core/types'
import type { DrawInputRuntime } from '../../features/draw/input'
import type { EdgeInputRuntime } from '../../features/edge/input'
import type {
  ContextDismissMode,
  ContextOpenInput
} from '../context'

type EngineCommands = EngineInstance['commands']
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

export type EditorState = {
  tool: ReadStore<Tool>
  draw: ReadStore<DrawPreferences>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionTarget>
  frame: ReadStore<FrameScope>
  interaction: ReadStore<InteractionState>
}

export type EditorRead = RuntimeRead
export type EditorViewport = ViewportRead

export type EditorHostBridge = {
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
  commit: (input: {
    nodeId: NodeId
    field: 'text' | 'title'
    value: string
    measuredSize?: Size
  }) => CommandResult
  setColor: (nodeIds: readonly NodeId[], color: string) => CommandResult
  setFontSize: (input: {
    nodeIds: readonly NodeId[]
    value?: number
    measuredSizeById?: Readonly<Record<NodeId, Size>>
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

export type EditorHost = {
  registry: NodeRegistry
  interaction: InteractionCoordinator
  viewport: ViewportRuntime
  pick: PickRuntime
  snap: SnapRuntime
  selection: {
    marquee: MarqueeSession
    gesture: SelectionGesture
  }
  draw: DrawInputRuntime
  node: NodeFeatureRuntime & {
    transform: NodeTransformSession
  }
  edge: {
    preview: EdgePreview
    connect: EdgeConnectSession
    input: EdgeInputRuntime
  }
  mindmap: {
    drag: MindmapDragStore
    controller: MindmapDragController
  }
}

export type Editor = {
  config: Readonly<EngineBoardConfig>
  read: EditorRead
  state: EditorState
  commands: EditorCommands
  viewport: EditorViewport
  host: EditorHost
  configure: (config: {
    tool: Tool
    viewport: {
      minZoom: number
      maxZoom: number
    }
    mindmapLayout: MindmapLayoutConfig
    history?: KernelHistoryConfig
  }) => void
  dispose: () => void
}

export type InternalEditor = Editor & {
  engine: EngineInstance
  interaction: InteractionCoordinator
  registry: NodeRegistry
  internals: {
    host: {
      clipboard: {
        runtime: ClipboardRuntime
        port: ClipboardPort
      }
      selectionLock: DocumentSelectionLock
      pointerContinuation: PointerContinuation
    }
    viewport: ViewportRuntime
    pick: PickRuntime
    snap: SnapRuntime
    selection: {
      marquee: MarqueeSession
      gesture: SelectionGesture
    }
    draw: DrawInputRuntime
    node: NodeFeatureRuntime & {
      transform: NodeTransformSession
    }
    edge: {
      preview: EdgePreview
      connect: EdgeConnectSession
      input: EdgeInputRuntime
    }
    mindmapDrag: MindmapDragStore
    mindmapDragController: MindmapDragController
  }
}
