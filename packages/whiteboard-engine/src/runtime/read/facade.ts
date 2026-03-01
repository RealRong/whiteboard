import { type createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EngineRead, ReadPublicKey } from '@engine-types/instance/read'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms'
import type { Change } from '../write/pipeline/ChangeBus'
import { context as createReadContext } from './context'
import { feature as edgeFeature } from './edge/feature'
import { feature as nodeFeature } from './node/feature'
import { feature as mindmapFeature } from './mindmap/feature'

type Options = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  readAtoms: ReadAtoms
  config: InstanceConfig
  getNodeRect: QueryCanvas['nodeRect']
}

export type ReadStore = {
  read: EngineRead
  applyChange: (change: Change) => void
}

export const store = ({
  runtimeStore,
  stateAtoms,
  readAtoms,
  config,
  getNodeRect
}: Options): ReadStore => {
  const readContext = createReadContext({
    runtimeStore,
    stateAtoms,
    readAtoms,
    config,
    query: {
      nodeRect: getNodeRect
    }
  })

  const edgeRead = edgeFeature(readContext)

  const nodeRead = nodeFeature(readContext)

  const mindmapRead = mindmapFeature(readContext)

  const applyChange: ReadStore['applyChange'] = (change) => {
    edgeRead.applyChange(change)
  }

  const atoms = {
    interaction: stateAtoms.interaction,
    tool: stateAtoms.tool,
    selection: stateAtoms.selection,
    viewport: stateAtoms.viewport,
    mindmapLayout: stateAtoms.mindmapLayout,
    ...nodeRead.atoms,
    ...edgeRead.atoms,
    ...mindmapRead.atoms
  }

  return {
    applyChange,
    read: {
      store: readContext.store,
      atoms,
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
