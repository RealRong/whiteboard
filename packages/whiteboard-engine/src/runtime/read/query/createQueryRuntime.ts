import type { Document } from '@whiteboard/core/types'
import type { Query } from '@engine-types/instance/query'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { ViewportApi } from '@engine-types/viewport'
import type { MutationMeta } from '../../write/pipeline/MutationMetaBus'
import { createQueryIndexRuntime } from '../indexes/QueryIndexRuntime'
import { createCanvas } from './Canvas'
import { createConfig } from './Config'
import { createDocument } from './Document'
import { createGeometry } from './Geometry'
import { createSnap } from './Snap'
import { createViewport } from './Viewport'

type Options = {
  readSnapshot: () => ReadModelSnapshot
  config: InstanceConfig
  readDoc: () => Document
  viewport: ViewportApi
}

export type QueryRuntime = {
  query: Query
  applyMutation: (meta: MutationMeta) => void
}

export const createQueryRuntime = ({
  readSnapshot,
  config,
  readDoc,
  viewport
}: Options): QueryRuntime => {
  const queryIndex = createQueryIndexRuntime({
    readSnapshot,
    config
  })

  const canvas = createCanvas({
    indexes: queryIndex
  })
  const snap = createSnap({
    indexes: queryIndex
  })
  const geometry = createGeometry({
    config
  })
  const doc = createDocument({
    readDoc
  })
  const viewportQuery = createViewport({
    viewport
  })
  const configQuery = createConfig({
    config
  })

  return {
    applyMutation: queryIndex.applyMutation,
    query: {
      doc,
      viewport: viewportQuery,
      config: configQuery,
      canvas,
      snap,
      geometry
    }
  }
}
