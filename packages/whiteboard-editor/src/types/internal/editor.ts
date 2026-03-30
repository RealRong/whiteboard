import type { Point } from '@whiteboard/core/types'
import type { ValueStore } from '@whiteboard/engine'
import type { DrawCommands, DrawPreferences } from '../draw'
import type {
  Editor,
  EditorPlatformBridge
} from '../editor'
import type { Tool } from '../tool'
import type { SelectionStore } from './selection'
import type { NodeRegistry } from '../node'
import type {
  ClipboardPort,
  ClipboardRuntime
} from '../../runtime/platform/clipboard'
import type { DocumentSelectionLock } from '../../runtime/platform/selectionLock'
import type { PointerContinuation } from '../../runtime/platform/pointerContinuation'
import type { PickRuntime } from '../../runtime/pick'
import type {
  InteractionCoordinator,
  InteractionRegistry
} from '../../runtime/interaction/types'
import type { PassiveInputRuntime } from '../../runtime/input/passive'
import type { ViewportRuntime } from '../../runtime/viewport'
import type { EditState } from '../../runtime/edit'
import type { FrameState } from '../../runtime/frame'

type EngineInstance = import('@whiteboard/engine').EngineInstance

export type EditorPlatformRuntime = {
  clipboardRuntime: ClipboardRuntime
  clipboardPort: ClipboardPort
  selectionLock: DocumentSelectionLock
  pointerContinuation: PointerContinuation
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

export type EditorKernel = {
  engine: EngineInstance
  registry: NodeRegistry
  viewport: ViewportRuntime
  pick: PickRuntime
  interaction: InteractionCoordinator
  clipboard: {
    runtime: ClipboardRuntime
    port: ClipboardPort
  }
  inputPolicy: ValueStore<EditorInputPolicy>
  tool: ValueStore<Tool>
  edit: EditState
  frame: FrameState
  selection: SelectionStore
}

export type EditorInputInternals = {
  interactions: InteractionRegistry
  passive: PassiveInputRuntime
  policy: ValueStore<EditorInputPolicy>
}

export type EditorViewportRuntime =
  Editor['viewport'] & Pick<ViewportRuntime, 'input' | 'setRect' | 'setLimits'>

export type EditorRuntime = Editor & {
  interaction: InteractionCoordinator
  registry: NodeRegistry
  pick: PickRuntime
  viewport: EditorViewportRuntime
}

export type EditorCommandHost = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

export type EditorClipboardRuntime = {
  runtime: ClipboardRuntime
  port: ClipboardPort
  readPointerWorld: () => Point | undefined
}

export type {
  EditorPlatformBridge
}
