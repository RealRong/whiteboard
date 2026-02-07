import type { Core } from '../types/core'
import type { CoreState } from './state'

export const createQuery = (state: CoreState): Core['query'] => ({
  document: () => {
    const document = state.getDocument()
    return {
      ...document,
      nodes: document.nodes.map(state.cloneNode),
      edges: document.edges.map(state.cloneEdge),
      mindmaps: document.mindmaps?.map(state.cloneMindmapTree),
      order: {
        nodes: [...document.order.nodes],
        edges: [...document.order.edges]
      },
      background: document.background ? { ...document.background } : undefined,
      viewport: document.viewport
        ? {
            zoom: document.viewport.zoom,
            center: state.clonePoint(document.viewport.center)
          }
        : undefined,
      meta: document.meta ? { ...document.meta } : undefined
    }
  },
  node: {
    get: (id) => {
      const node = state.maps.nodes.get(id)
      return node ? state.cloneNode(node) : undefined
    },
    list: () => state.getDocument().nodes.map(state.cloneNode)
  },
  edge: {
    get: (id) => {
      const edge = state.maps.edges.get(id)
      return edge ? state.cloneEdge(edge) : undefined
    },
    list: () => state.getDocument().edges.map(state.cloneEdge),
    byNode: (id) =>
      state
        .getDocument()
        .edges.filter((edge) => edge.source.nodeId === id || edge.target.nodeId === id)
        .map(state.cloneEdge)
  },
  mindmap: {
    get: (id) => {
      const mindmap = state.maps.mindmaps.get(id)
      return mindmap ? state.cloneMindmapTree(mindmap) : undefined
    },
    list: () => Array.from(state.maps.mindmaps.values()).map(state.cloneMindmapTree)
  },
  viewport: () => {
    const viewport = state.getDocument().viewport
    return viewport
      ? { center: state.clonePoint(viewport.center), zoom: viewport.zoom }
      : { center: { x: 0, y: 0 }, zoom: 1 }
  }
})
