import type { HistoryState } from '@whiteboard/core/kernel'
import type { Point } from '@whiteboard/core/types'
import type { ValueStore } from '@whiteboard/engine'
import type { DrawInputRuntime } from '../../features/draw/input'
import type { EdgeProjection } from '../../features/edge/projection'
import type { MindmapDragProjectionStore } from '../../features/mindmap/drag/projection'
import type { NodeProjectionRuntime } from '../../features/node/projection/store'
import type { MarqueeSession } from '../../features/selection/marquee'
import type { DrawCommands, DrawPreferences } from '../public/draw'
import type {
  Editor,
  EditorPlatformBridge,
  EditorProjection
} from '../public/editor'
import type { Tool } from '../public/tool'
import type { SelectionStore } from './selection'
import type { NodeRegistry } from '../node'
import type {
  ClipboardPort,
  ClipboardRuntime
} from '../../runtime/platform/clipboard'
import type { DocumentSelectionLock } from '../../runtime/platform/selectionLock'
import type { PointerContinuation } from '../../runtime/platform/pointerContinuation'
import type { PickRuntime } from '../../runtime/pick'
import type { InteractionCoordinator } from '../../runtime/interaction'
import type { InteractionRegistry } from '../../runtime/interaction/registry'
import type { SnapRuntime } from '../../runtime/interaction/snap'
import type { PassiveInputRuntime } from '../../runtime/input/passive'
import type { ViewportRuntime } from '../../runtime/viewport'
import type { EditState } from '../../runtime/edit'
import type { FrameState } from '../../runtime/frame'
import type { EditorFeatureCapsule } from '../runtime/editor/capsule'

type EngineInstance = import('@whiteboard/engine').EngineInstance

export type EditorPlatformRuntime = {
  clipboardRuntime: ClipboardRuntime
  clipboardPort: ClipboardPort
  selectionLock: DocumentSelectionLock
  pointerContinuation: PointerContinuation
}

export type EditorBaseState = {
  tool: ValueStore<Tool>
  edit: EditState
  frame: FrameState
  selection: SelectionStore
}

export type DrawFeatureState = {
  store: ValueStore<DrawPreferences>
  commands: DrawCommands
}

export type EditorInputPolicy = {
  panEnabled: boolean
  wheelEnabled: boolean
  wheelSensitivity: number
}

export type EditorRuntimeConfig = {
  inputPolicy: ValueStore<EditorInputPolicy>
}

export type EditorKernel = {
  document: {
    engine: EngineInstance
    registry: NodeRegistry
    history: ValueStore<HistoryState>
  }
  interaction: InteractionCoordinator
  spatial: {
    viewport: ViewportRuntime
    pick: PickRuntime
    snap: SnapRuntime
  }
  platform: EditorPlatformRuntime
  state: EditorBaseState
  config: EditorRuntimeConfig
}

export type EditorProjectionGraph = {
  model: {
    node: NodeProjectionRuntime
  }
  overlay: {
    marquee: Pick<MarqueeSession, 'rect' | 'match'>
    draw: Pick<DrawInputRuntime['preview'], 'get' | 'subscribe'>
    edge: EdgeProjection
    mindmapDrag: MindmapDragProjectionStore
    snap: SnapRuntime['node']['guides']
  }
}

export type EditorInputInternals = {
  interactions: InteractionRegistry
  passive: PassiveInputRuntime
  policy: ValueStore<EditorInputPolicy>
}

export type EditorViewportRuntime =
  Editor['viewport'] & Pick<ViewportRuntime, 'input' | 'setRect' | 'setLimits'>

export type EditorRuntimeInternals = {
  kernel: EditorKernel
  projections: EditorProjectionGraph
  capsules: readonly EditorFeatureCapsule[]
  input: EditorInputInternals
}

export type EditorRuntime = Editor & {
  interaction: InteractionCoordinator
  registry: NodeRegistry
  pick: PickRuntime
  projection: EditorProjection
  viewport: EditorViewportRuntime
  internals: EditorRuntimeInternals
}

export type EditorCommandHost = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

export type EditorClipboardRuntime = {
  runtime: ClipboardRuntime
  port: ClipboardPort
  readPointerWorld: () => Point | undefined
}

export type {
  DrawInputRuntime,
  EdgeProjection,
  MindmapDragProjectionStore,
  NodeProjectionRuntime,
  MarqueeSession,
  EditorPlatformBridge
}
