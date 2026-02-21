import type { State } from '@engine-types/instance/state'
import type { ViewSnapshot } from '@engine-types/instance/view'
import type { EdgeViewQuery } from './query'

type EdgeDerivationOptions = {
  readState: State['read']
  edgeViewQuery: EdgeViewQuery
}

export const EDGE_VIEW_DERIVATION_DEPS = {
  paths: ['edgeConnect', 'graph.visibleEdges', 'graph.canvasNodes'] as const,
  preview: ['edgeConnect', 'graph.canvasNodes', 'tool'] as const,
  selectedEndpoints: ['edgeSelection', 'graph.visibleEdges', 'graph.canvasNodes'] as const,
  selectedRouting: ['edgeSelection', 'graph.visibleEdges'] as const
}

export const createEdgeViewDerivations = ({
  readState,
  edgeViewQuery
}: EdgeDerivationOptions) => {
  const paths = (): ViewSnapshot['edge.paths'] =>
    edgeViewQuery.getPaths(readState('edgeConnect'))

  const preview = (): ViewSnapshot['edge.preview'] => {
    const edgeConnect = readState('edgeConnect')
    const tool = readState('tool')
    const resolved = edgeViewQuery.getPreview(edgeConnect)
    return {
      from: resolved.showPreviewLine ? resolved.from : undefined,
      to: resolved.showPreviewLine ? resolved.to : undefined,
      snap: tool === 'edge' ? resolved.hover : undefined,
      reconnect: resolved.reconnect,
      showPreviewLine: resolved.showPreviewLine
    }
  }

  const selectedEndpoints = (): ViewSnapshot['edge.selectedEndpoints'] => {
    const selectedEdgeId = readState('edgeSelection')
    if (!selectedEdgeId) return undefined
    const edge = edgeViewQuery.getEdge(selectedEdgeId)
    if (!edge) return undefined
    return edgeViewQuery.getEndpoints(edge)
  }

  const selectedRouting = (): ViewSnapshot['edge.selectedRouting'] => {
    const selectedEdgeId = readState('edgeSelection')
    if (!selectedEdgeId) return undefined
    const edge = edgeViewQuery.getEdge(selectedEdgeId)
    if (!edge) return undefined
    const points = edge.routing?.points
    if (!points?.length) return undefined
    return {
      edge,
      points
    }
  }

  return {
    paths,
    preview,
    selectedEndpoints,
    selectedRouting
  }
}

