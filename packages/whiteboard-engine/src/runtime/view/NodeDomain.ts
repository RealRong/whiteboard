import type {
  ProjectionChange,
  ProjectionSnapshot
} from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type {
  NodesView
} from '@engine-types/instance/view'
import {
  createNodeRegistry
} from './NodeRegistry'

type Options = {
  query: Query
  readProjection: () => ProjectionSnapshot
}

export type NodeDomain = {
  syncProjection: (change: ProjectionChange) => boolean
  getState: () => NodesView
}

export const createNodeDomain = ({
  query,
  readProjection
}: Options): NodeDomain => {
  const node = createNodeRegistry({
    query,
    readProjection
  })

  const readNodeItems = () => node.getNodeItemsMap()

  const syncProjection = (change: ProjectionChange) => {
    return node.syncProjection(change)
  }

  const getState = (): NodesView => ({
    ids: node.getNodeIds(),
    byId: readNodeItems()
  })

  return {
    syncProjection,
    getState
  }
}
