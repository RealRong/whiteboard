import type { Document } from '@whiteboard/core/types'
import type { Query } from '@engine-types/instance/query'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { ProjectionStore } from '@engine-types/projection'
import type { ViewportApi } from '@engine-types/viewport'
import { createQueryIndexRuntime } from '../read/indexes'
import { createCanvas } from './Canvas'
import { createConfig } from './Config'
import { createDocument } from './Document'
import { createGeometry } from './Geometry'
import { createSnap } from './Snap'
import { createViewport } from './Viewport'

type Options = {
  projection: ProjectionStore
  config: InstanceConfig
  readDoc: () => Document
  viewport: ViewportApi
}

export type QueryRuntime = {
  query: Query
}

export const createQueryRuntime = ({
  projection,
  config,
  readDoc,
  viewport
}: Options): QueryRuntime => {
  const queryIndex = createQueryIndexRuntime({
    projection,
    config
  })

  projection.subscribe((commit) => {
    queryIndex.applyCommit(commit)
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
