import { type createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { EngineRead, ReadPublicKey } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { Atom } from 'jotai/vanilla'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadChangePlan } from './changePlan'
import { context as createReadContext } from './context'
import { runtime as createEdgeRuntime } from './edge/runtime'
import { runtime as createNodeRuntime } from './node/runtime'
import { runtime as createMindmapRuntime } from './mindmap/runtime'

type Options = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  snapshotAtom: Atom<ReadModelSnapshot>
  config: InstanceConfig
  query: Query
}

export type ReadRuntime = {
  read: EngineRead
  applyChange: (plan: ReadChangePlan) => void
}

export const runtime = ({
  runtimeStore,
  stateAtoms,
  snapshotAtom,
  config,
  query
}: Options): ReadRuntime => {
  const readContext = createReadContext({
    runtimeStore,
    stateAtoms,
    snapshotAtom,
    config,
    query
  })

  const edgeRead = createEdgeRuntime(readContext)

  const nodeRead = createNodeRuntime(readContext)

  const mindmapRead = createMindmapRuntime(readContext)

  const applyChange: ReadRuntime['applyChange'] = (plan) => {
    edgeRead.applyChange(plan)
    nodeRead.applyChange(plan)
    mindmapRead.applyChange(plan)
  }

  return {
    applyChange,
    read: {
      get: Object.assign(
        ((key: ReadPublicKey) => readContext.get(key)) as EngineRead['get'],
        {
          ...nodeRead.get,
          edgeIds: edgeRead.get.edgeIds,
          edgeById: edgeRead.get.edgeById,
          selectedEdgeId: edgeRead.get.selectedEdgeId,
          edgeSelectedEndpoints: edgeRead.get.edgeSelectedEndpoints,
          ...mindmapRead.get
        }
      ),
      subscribe: (keys, listener) => readContext.subscribe(keys, listener)
    }
  }
}
