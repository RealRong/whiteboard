import type { Document } from '@whiteboard/core/types'
import type { createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'
import type { State } from '@engine-types/instance/state'
import type { ViewportApi } from '@engine-types/viewport'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms/read'
import type { Change } from '../write/pipeline/ChangeBus'
import { store as readStore } from './store'
import { runtime as indexRuntime } from './index/runtime'
import { canvas } from './query/canvas'
import { config as queryConfig } from './query/config'
import { document as queryDocument } from './query/document'
import { geometry } from './query/geometry'
import { snap } from './query/snap'
import { viewport as queryViewport } from './query/viewport'

type Options = {
  state: State
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  readAtoms: ReadAtoms
  config: InstanceConfig
  readDoc: () => Document
  viewport: ViewportApi
}

export type ReadRuntime = {
  query: Query
  read: EngineRead
  applyChange: (change: Change) => void
}

export const runtime = ({
  state,
  runtimeStore,
  stateAtoms,
  readAtoms,
  config,
  readDoc,
  viewport
}: Options): ReadRuntime => {
  const readSnapshot = () => runtimeStore.get(readAtoms.snapshot)

  const index = indexRuntime({
    readSnapshot,
    config
  })

  const canvasQuery = canvas({
    indexes: index
  })
  const snapQuery = snap({
    indexes: index
  })

  const query: Query = {
    doc: queryDocument({ readDoc }),
    viewport: queryViewport({ viewport }),
    config: queryConfig({ config }),
    canvas: canvasQuery,
    snap: snapQuery,
    geometry: geometry({ config })
  }

  const readLayer = readStore({
    state,
    runtimeStore,
    stateAtoms,
    readAtoms,
    config,
    getNodeRect: canvasQuery.nodeRect
  })

  return {
    query,
    read: readLayer.read,
    applyChange: (change) => {
      index.applyChange(change)
      readLayer.applyChange(change)
    }
  }
}
