import type { Document } from '@whiteboard/core/types'
import type { createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'
import type { ViewportApi } from '@engine-types/viewport'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms'
import type { Change } from '../write/pipeline/ChangeBus'
import { toReadChangePlan } from './changePlan'
import { facade as readFacade } from './facade'
import { indexRuntime as createIndexRuntime } from './indexRuntime'
import { queryFactory } from './queryFactory'

type Options = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  readAtoms: ReadAtoms
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
  readAtoms,
  config,
  readDoc,
  viewport
}: Options): ReadOrchestrator => {
  const initialSnapshot = runtimeStore.get(readAtoms.snapshot)
  const indexes = createIndexRuntime(config, initialSnapshot.nodes.canvas)
  const query: Query = queryFactory({
    readDoc,
    viewport,
    config,
    indexes
  })

  const readLayer = readFacade({
    runtimeStore,
    stateAtoms,
    readAtoms,
    config,
    query
  })

  return {
    query,
    read: readLayer.read,
    applyChange: (change) => {
      const plan = toReadChangePlan(change)
      if (plan.index.mode !== 'none') {
        const snapshot = runtimeStore.get(readAtoms.snapshot)
        indexes.applyPlan(plan.index, snapshot)
      }
      readLayer.applyChange(plan)
    }
  }
}
