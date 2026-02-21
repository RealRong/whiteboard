import type { Commands } from '@engine-types/commands'
import type {
  InputConfig,
  InputSessionContext,
  PointerSession
} from '@engine-types/input'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { RuntimeInternal } from '@engine-types/instance/runtime'
import type { State } from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'
import { DEFAULT_CONFIG } from '../../config'
import type { InputRuntime } from './InputGateway'

export type InputRuntimeOptions = {
  state: Pick<State, 'read' | 'write' | 'batch'>
  commands: Commands
  query: Query
  actors: InputSessionContext['actors']
  runtime: Pick<RuntimeInternal, 'services' | 'shortcuts'>
  view: Pick<View, 'global' | 'edge'>
  config: InstanceConfig
  inputConfig?: InputConfig
  sessions?: PointerSession[]
}

export const createDefaultInputConfig = (): InputConfig => ({
  viewport: {
    minZoom: DEFAULT_CONFIG.viewport.minZoom,
    maxZoom: DEFAULT_CONFIG.viewport.maxZoom,
    enablePan: DEFAULT_CONFIG.viewport.enablePan,
    enableWheel: DEFAULT_CONFIG.viewport.enableWheel,
    wheelSensitivity: DEFAULT_CONFIG.viewport.wheelSensitivity
  }
})

export const createInputRuntime = ({
  state,
  commands,
  query,
  actors,
  runtime,
  view,
  config,
  inputConfig,
  sessions
}: InputRuntimeOptions): InputRuntime => ({
  getContext: () => ({
    state,
    commands,
    query,
    actors,
    services: {
      viewportNavigation: runtime.services.viewportNavigation
    },
    shortcuts: runtime.shortcuts,
    view: {
      getShortcutContext: () => view.global.shortcutContext(),
      edgePath: (edgeId) => view.edge.path(edgeId)
    },
    config
  }),
  config: inputConfig ?? createDefaultInputConfig(),
  sessions
})
