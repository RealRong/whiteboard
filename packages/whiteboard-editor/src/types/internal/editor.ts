import type { ValueStore } from '@whiteboard/engine'
import type { DrawCommands, DrawPreferences } from '../draw'
import type {
  Editor
} from '../editor'
import type { Tool } from '../tool'
import type { SelectionStore } from './selection'
import type { NodeRegistry } from '../node'
import type {
  InteractionCoordinator,
  InteractionRegistry
} from '../runtime/interaction'
import type { PassiveInputRuntime } from '../../runtime/input/passive'
import type { ViewportRuntime } from '../../runtime/viewport'
import type { EditState } from '../../runtime/edit'
import type { FrameState } from '../../runtime/frame'

type EngineInstance = import('@whiteboard/engine').EngineInstance

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
  interaction: InteractionCoordinator
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

export type EditorCommandHost = Pick<Editor, 'commands' | 'read'>
