import { type createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { EngineRead, ReadPublicKey } from '@engine-types/instance/read'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms'
import type { ReadChangePlan } from './changePlan'
import { context as createReadContext } from './context'
import { domain as edgeDomain } from './edge/domain'
import { domain as nodeDomain } from './node/domain'
import { domain as mindmapDomain } from './mindmap/domain'

type Options = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  readAtoms: ReadAtoms
  config: InstanceConfig
  query: Query
}

export type ReadFacade = {
  read: EngineRead
  applyChange: (plan: ReadChangePlan) => void
}

export const facade = ({
  runtimeStore,
  stateAtoms,
  readAtoms,
  config,
  query
}: Options): ReadFacade => {
  const readContext = createReadContext({
    runtimeStore,
    stateAtoms,
    readAtoms,
    config,
    query
  })

  const edgeRead = edgeDomain(readContext)

  const nodeRead = nodeDomain(readContext)

  const mindmapRead = mindmapDomain(readContext)

  const applyChange: ReadFacade['applyChange'] = (plan) => {
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
