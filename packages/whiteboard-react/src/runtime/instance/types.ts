import type { BoardConfig as EngineBoardConfig } from '@whiteboard/core/config'
import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  EngineInstance
} from '@whiteboard/engine'
import type { MindmapLayoutConfig } from '../../types/mindmap'
import type { RuntimeRead } from '../read'
import type {
  FrameScope
} from '../frame'
import type {
  Input as SelectionInput,
  Source as SelectionSource
} from '../selection'
import type {
  ViewportCommands,
  ViewportRead
} from '../viewport'
import type { ViewportRuntime } from '../viewport/createViewport'
import type { NodeRegistry } from '../../types/node'
import type {
  InteractionCoordinator,
  InteractionMode
} from '../interaction/types'
import type { SnapRuntime } from '../interaction/snap'
import type { NodeFeatureRuntime } from '../../features/node/session/runtime'
import type { EdgePreview } from '../../features/edge/preview'
import type { MindmapDragStore } from '../../features/mindmap/session/drag'
import type {
  DrawKind,
  EdgePresetKey,
  Tool
} from '../tool'
import type { EditField, EditTarget } from '../edit'
import type {
  BrushStylePatch,
  DrawSlot,
  DrawState
} from '../../features/draw/state'
import type { PickRuntime } from '../pick'

type EngineCommands = EngineInstance['commands']

export type WhiteboardInstance = {
  read: RuntimeRead
  state: {
    tool: ReadStore<Tool>
    draw: ReadStore<DrawState>
    edit: ReadStore<EditTarget>
    selection: ReadStore<SelectionSource>
    frame: ReadStore<FrameScope>
    interaction: ReadStore<InteractionMode>
  }
  commands: Omit<EngineCommands, 'tool' | 'selection' | 'interaction' | 'edge' | 'viewport'> & {
    tool: {
      set: (tool: Tool) => void
      select: () => void
      hand: () => void
      edge: (preset?: EdgePresetKey) => void
      insert: (preset: string) => void
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
  }
  viewport: ViewportRead
}

export type InternalInstance = WhiteboardInstance & {
  config: Readonly<EngineBoardConfig>
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
  engine: EngineInstance
  interaction: InteractionCoordinator
  registry: NodeRegistry
  internals: {
    viewport: ViewportRuntime
    pick: PickRuntime
    snap: SnapRuntime
    node: NodeFeatureRuntime
    edge: {
      preview: EdgePreview
    }
    mindmapDrag: MindmapDragStore
  }
}
