import type { ValueStore } from '@whiteboard/engine'
import type {
  Editor
} from '../../types/editor'
import type { Tool } from '../../types/tool'
import type { NodeRegistry } from '../../types/node'
import type {
  InteractionCoordinator,
  InteractionRegistry
} from '../../types/runtime/interaction'
import type { PassiveInputRuntime } from '../input/passive'
import type { ViewportRuntime } from '../viewport'
import type { EditState } from '../state/edit'
import type { SelectionState } from '../state/selection'

type EngineInstance = import('@whiteboard/engine').EngineInstance

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
  selection: SelectionState
}

export type EditorInputInternals = {
  interactions: InteractionRegistry
  passive: PassiveInputRuntime
  policy: ValueStore<EditorInputPolicy>
}

export type EditorViewportRuntime =
  Editor['viewport'] & Pick<ViewportRuntime, 'input' | 'setRect' | 'setLimits'>

export type EditorCommandHost = Pick<Editor, 'commands' | 'read'>
