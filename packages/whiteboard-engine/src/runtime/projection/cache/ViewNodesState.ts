import type {
  Document,
  Node,
  NodeId
} from '@whiteboard/core/types'
import { buildIndexById } from './shared'

type ViewNodesCache = {
  sourceNodesRef: Document['nodes']
  nodes: Node[]
  indexById: Map<NodeId, number>
}

export type ViewNodesUpdate = {
  cache: ViewNodesCache
  sourceNodesChanged: boolean
  changedNodeIds: Set<NodeId>
}

const buildCache = (doc: Document): ViewNodesCache => ({
  sourceNodesRef: doc.nodes,
  nodes: doc.nodes,
  indexById: buildIndexById(doc.nodes)
})

export class ViewNodesState {
  private cache: ViewNodesCache | null = null

  reset = () => {
    this.cache = null
  }

  update = (doc: Document): ViewNodesUpdate => {
    const current = this.cache
    if (current && current.sourceNodesRef === doc.nodes) {
      return {
        cache: current,
        sourceNodesChanged: false,
        changedNodeIds: new Set<NodeId>()
      }
    }

    const cache = buildCache(doc)
    this.cache = cache
    return {
      cache,
      sourceNodesChanged: true,
      changedNodeIds: new Set(doc.nodes.map((node) => node.id))
    }
  }
}
