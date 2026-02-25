import type {
  ProjectionCommit,
  ProjectionSnapshot
} from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type { Render } from '@engine-types/instance/render'
import type {
  NodesView
} from '@engine-types/instance/view'
import {
  createNodeRegistry,
  type NodeStateSyncKey
} from './NodeRegistry'

type Options = {
  query: Query
  readProjection: () => ProjectionSnapshot
  readRender: Render['read']
}

export type NodeDomain = {
  syncState: (key: NodeStateSyncKey) => boolean
  applyCommit: (commit: ProjectionCommit) => boolean
  getState: () => NodesView
}

export const createNodeDomain = ({
  query,
  readProjection,
  readRender
}: Options): NodeDomain => {
  const node = createNodeRegistry({
    query,
    readProjection,
    readPreviewUpdates: () =>
      readRender('nodePreview').updates
  })

  const readNodeItems = () => node.getNodeItemsMap()

  const applyCommit = (commit: ProjectionCommit) => {
    return node.applyCommit(commit)
  }

  const syncState = (key: NodeStateSyncKey) =>
    node.syncState(key)

  const getState = (): NodesView => ({
    ids: node.getNodeIds(),
    byId: readNodeItems()
  })

  return {
    syncState,
    applyCommit,
    getState
  }
}
