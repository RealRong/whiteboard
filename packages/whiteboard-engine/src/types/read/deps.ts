import type { createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '../instance/config'
import type { Atoms as StoreAtoms } from '../internal/store'

export type Deps = {
  store: ReturnType<typeof createStore>
  stateAtoms: StoreAtoms
  config: InstanceConfig
}
