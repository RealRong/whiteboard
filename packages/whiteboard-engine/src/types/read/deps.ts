import type { Document } from '@whiteboard/core/types'
import type { Atom, createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '../instance/config'
import type { Atoms as StateAtoms } from '../state/factory'
import type { ReadModelSnapshot } from './snapshot'
import type { ViewportApi } from '../viewport/api'

export type Deps = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  snapshotAtom: Atom<ReadModelSnapshot>
  config: InstanceConfig
  readDoc: () => Document
  viewport: ViewportApi
}
