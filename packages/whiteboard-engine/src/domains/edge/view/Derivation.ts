import type { State } from '@engine-types/instance/state'
import type { Render } from '@engine-types/instance/render'
import type {
  EdgeEndpoints,
  EdgePathEntry,
  EdgePreviewView,
  EdgeSelectedRoutingView
} from '@engine-types/instance/view'
import type { EdgeViewQuery } from './query'

type EdgeDerivationOptions = {
  readState: State['read']
  readRender: Render['read']
  edgeViewQuery: EdgeViewQuery
}

export const createEdgeViewDerivations = ({
  readState,
  readRender,
  edgeViewQuery
}: EdgeDerivationOptions) => {
  const emptyPreview: EdgePreviewView = {
    from: undefined,
    to: undefined,
    snap: undefined,
    reconnect: undefined,
    showPreviewLine: false
  }

  const paths = (): EdgePathEntry[] =>
    edgeViewQuery.getPaths(readRender('routingDrag'))

  const preview = (): EdgePreviewView =>
    emptyPreview

  const selectedEndpoints = (): EdgeEndpoints | undefined => {
    const selectedEdgeId = readState('selection').selectedEdgeId
    if (!selectedEdgeId) return undefined
    const edge = edgeViewQuery.getEdge(selectedEdgeId)
    if (!edge) return undefined
    return edgeViewQuery.getEndpoints(edge)
  }

  const selectedRouting = (): EdgeSelectedRoutingView => {
    const selectedEdgeId = readState('selection').selectedEdgeId
    if (!selectedEdgeId) return undefined
    const edge = edgeViewQuery.getEdge(selectedEdgeId)
    if (!edge) return undefined
    const points = edge.routing?.points
    if (!points?.length) return undefined
    const activeDrag = readRender('routingDrag').payload
    const previewPoints =
      activeDrag && activeDrag.edgeId === edge.id
        ? points.map((point, index) =>
            index === activeDrag.index ? activeDrag.point : point
          )
        : points
    return {
      edge,
      points: previewPoints
    }
  }

  return {
    paths,
    preview,
    selectedEndpoints,
    selectedRouting
  }
}
