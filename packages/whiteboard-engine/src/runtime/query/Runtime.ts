import type { Document } from '@whiteboard/core/types'
import type { Query } from '@engine-types/instance/query'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { ProjectionCommit, ProjectionStore } from '@engine-types/projection'
import type { ViewportApi } from '@engine-types/viewport'
import { hasImpactTag } from '../mutation/Impact'
import { createCanvas } from './Canvas'
import { createConfig } from './Config'
import { createDocument } from './Document'
import { createGeometry } from './Geometry'
import { createQueryIndexes } from './Indexes'
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
  let snapshot = projection.getSnapshot()
  let latestCommit: ProjectionCommit | undefined
  let indexRevision = snapshot.revision

  const indexes = createQueryIndexes({
    config
  })
  indexes.sync(snapshot.nodes.canvas)

  const syncIndexes = (commit: ProjectionCommit) => {
    const impact = commit.impact
    if (commit.kind === 'replace' || hasImpactTag(impact, 'full')) {
      indexes.sync(snapshot.nodes.canvas)
      return
    }
    if (hasImpactTag(impact, 'order')) {
      indexes.sync(snapshot.nodes.canvas)
      return
    }
    if (impact.dirtyNodeIds?.length) {
      indexes.syncByNodeIds(impact.dirtyNodeIds, snapshot.indexes.canvasNodeById)
      return
    }
    if (hasImpactTag(impact, 'nodes') || hasImpactTag(impact, 'mindmap')) {
      indexes.sync(snapshot.nodes.canvas)
    }
  }

  const ensureIndexes = () => {
    if (!latestCommit) return
    if (indexRevision === latestCommit.revision) return
    syncIndexes(latestCommit)
    indexRevision = latestCommit.revision
  }

  projection.subscribe((commit) => {
    snapshot = commit.snapshot
    latestCommit = commit
  })

  const canvas = createCanvas({
    indexes,
    ensureIndexes
  })
  const snap = createSnap({
    indexes,
    ensureIndexes
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
