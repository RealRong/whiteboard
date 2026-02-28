import type { Document } from '@whiteboard/core/types'
import type { createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'
import type { State } from '@engine-types/instance/state'
import type { ViewportApi } from '@engine-types/viewport'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms/createReadAtoms'
import type { Change } from '../write/pipeline/ChangeBus'
import { createReadStore } from './createReadStore'
import { createIndex } from './index/createIndex'
import { createCanvas } from './query/canvas'
import { createConfig } from './query/config'
import { createDocument } from './query/document'
import { createGeometry } from './query/geometry'
import { createSnap } from './query/snap'
import { createViewport } from './query/viewport'

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

export const createReadRuntime = ({
  state,
  runtimeStore,
  stateAtoms,
  readAtoms,
  config,
  readDoc,
  viewport
}: Options): ReadRuntime => {
  const readSnapshot = () => runtimeStore.get(readAtoms.snapshot)

  const index = createIndex({
    readSnapshot,
    config
  })

  const canvas = createCanvas({
    indexes: index
  })
  const snap = createSnap({
    indexes: index
  })

  const query: Query = {
    doc: createDocument({ readDoc }),
    viewport: createViewport({ viewport }),
    config: createConfig({ config }),
    canvas,
    snap,
    geometry: createGeometry({ config })
  }

  const readStore = createReadStore({
    state,
    runtimeStore,
    stateAtoms,
    readAtoms,
    config,
    getNodeRect: canvas.nodeRect
  })

  return {
    query,
    read: readStore.read,
    applyChange: (change) => {
      index.applyChange(change)
      readStore.applyChange(change)
    }
  }
}
