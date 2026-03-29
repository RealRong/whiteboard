import type { HistoryState } from '@whiteboard/core/kernel'
import type { Point } from '@whiteboard/core/types'
import type { ValueStore } from '@whiteboard/engine'
import type { DrawInputRuntime } from '../../features/draw/input'
import type { EdgeConnectSession } from '../../features/edge/connectSession'
import type { EdgePreview } from '../../features/edge/preview'
import type { EdgeInputRuntime } from '../../features/edge/input'
import type { MindmapDragController } from '../../features/mindmap/dragSession'
import type { MindmapDragStore } from '../../features/mindmap/session/drag'
import type { NodeFeatureRuntime } from '../../features/node/session/node'
import type { NodeTransformSession } from '../../features/node/session/transform'
import type { MarqueeSession } from '../../features/selection/marquee'
import type { SelectionGesture } from '../../features/selection/gesture'
import type { DrawCommands, DrawPreferences } from '../public/draw'
import type { Editor, EditorHostBridge } from '../public/editor'
import type { Tool } from '../public/tool'
import type { SelectionStore } from './selection'
import type { NodeRegistry } from '../node'
import type {
  ClipboardPort,
  ClipboardRuntime
} from '../../runtime/host/clipboard'
import type { DocumentSelectionLock } from '../../runtime/host/selectionLock'
import type { PointerContinuation } from '../../runtime/host/pointerContinuation'
import type { PickRuntime } from '../../runtime/pick'
import type { InteractionCoordinator } from '../../runtime/interaction'
import type { SnapRuntime } from '../../runtime/interaction/snap'
import type { ViewportRuntime } from '../../runtime/viewport/createViewport'
import type { State as EditState } from '../../runtime/edit'
import { createState as createFrameState } from '../../runtime/frame'

export type EditorPlatform = {
  clipboardRuntime: ClipboardRuntime
  clipboardPort: ClipboardPort
  selectionLock: DocumentSelectionLock
  pointerContinuation: PointerContinuation
}

export type EditorStores = {
  tool: ValueStore<Tool>
  history: ValueStore<HistoryState>
  draw: {
    store: ValueStore<DrawPreferences>
    commands: DrawCommands
  }
  edit: EditState
  frame: ReturnType<typeof createFrameState>
  selection: SelectionStore
}

export type EditorInternals = {
  pick: PickRuntime
  node: NodeFeatureRuntime
  edge: {
    preview: EdgePreview
  }
  mindmapDrag: MindmapDragStore
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

export type EditorRuntime = Editor & {
  engine: import('@whiteboard/engine').EngineInstance
  host: EditorHost
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

export type EditorCommandHost = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

export type EditorCommandDocumentRuntime = {
  engine: import('@whiteboard/engine').EngineInstance
  read: Editor['read']
  state: Editor['state']
  history: {
    set: (value: HistoryState) => void
  }
  viewport: {
    commands: import('../../runtime/viewport').ViewportCommands
    read: Editor['viewport']
  }
}

export type EditorCommandSelectionRuntime = {
  edit: EditState['commands']
  selection: SelectionStore
  frame: ReturnType<typeof createFrameState>
}

export type EditorCommandToolRuntime = {
  tool: {
    get: () => Tool
    set: (tool: Tool) => void
  }
}

export type EditorCommandDrawRuntime = {
  draw: EditorStores['draw']
}

export type EditorCommandNodeRuntime = {
  runtime: NodeFeatureRuntime
}

export type EditorCommandClipboardRuntime = {
  runtime: ClipboardRuntime
  port: ClipboardPort
  readPointerWorld: () => Point | undefined
}

export type EditorCommandRuntime = {
  document: EditorCommandDocumentRuntime
  selection: EditorCommandSelectionRuntime
  tool: EditorCommandToolRuntime
  draw: EditorCommandDrawRuntime
  node: EditorCommandNodeRuntime
  clipboard: EditorCommandClipboardRuntime
}

export type { EditorHostBridge }
