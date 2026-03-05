import type { createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '../instance/config'
import type { Atoms as StateAtoms } from '../state/factory'
import type { ViewportReadApi } from '../viewport/api'

export type Deps = {
  store: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  config: InstanceConfig
  viewport: ViewportReadApi
}
