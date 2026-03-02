import type { Document } from '@whiteboard/core/types'
import type { createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { ViewportApi } from '@engine-types/viewport'
import type { Atom } from 'jotai/vanilla'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { Change } from '../write/pipeline/ChangeBus'
import { toReadChangePlan } from './changePlan'
import { runtime as createReadRuntime } from './runtime'
import { runtime as createIndexRuntime } from './index/runtime'
import { createQuery } from './query'

type Options = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  snapshotAtom: Atom<ReadModelSnapshot>
  config: InstanceConfig
  readDoc: () => Document
  viewport: ViewportApi
}

export type ReadOrchestrator = {
  query: Query
  read: EngineRead
  applyChange: (change: Change) => void
}

export const orchestrator = ({
  runtimeStore,
  stateAtoms,
  snapshotAtom,
  config,
  readDoc,
  viewport
}: Options): ReadOrchestrator => {
  const initialSnapshot = runtimeStore.get(snapshotAtom)
  const indexes = createIndexRuntime(config, initialSnapshot.nodes.canvas)
  const query: Query = createQuery({
    readDoc,
    viewport,
    config,
    indexes
  })

  const readLayer = createReadRuntime({
    runtimeStore,
    stateAtoms,
    snapshotAtom,
    config,
    query
  })

  return {
    query,
    read: readLayer.read,
    applyChange: (change) => {
      const plan = toReadChangePlan(change)
      if (plan.index.mode !== 'none') {
        const snapshot = runtimeStore.get(snapshotAtom)
        indexes.applyPlan(plan.index, snapshot)
      }
      readLayer.applyChange(plan)
    }
  }
}
