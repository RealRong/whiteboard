import type {
  ProjectionCommit,
  ProjectionSnapshot
} from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type {
  NodesView
} from '@engine-types/instance/view'
import { createNodeRegistry } from './NodeRegistry'

type Options = {
  query: Query
  readProjection: () => ProjectionSnapshot
}

export type NodeDomain = {
  applyCommit: (commit: ProjectionCommit) => boolean
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

  const applyCommit = (commit: ProjectionCommit) => {
    return node.applyCommit(commit)
  }

  const getState = (): NodesView => ({
    ids: node.getNodeIds(),
    byId: readNodeItems()
  })

  return {
    applyCommit,
    getState
  }
}
