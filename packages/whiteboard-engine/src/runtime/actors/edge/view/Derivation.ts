import type { State } from '@engine-types/instance/state'
import type {
  EdgeEndpoints,
  EdgePathEntry,
  EdgePreviewView,
  EdgeSelectedRoutingView
} from '@engine-types/instance/view'
import type { EdgeViewQuery } from './query'

type EdgeDerivationOptions = {
  readState: State['read']
  edgeViewQuery: EdgeViewQuery
}

export const createEdgeViewDerivations = ({
  readState,
  edgeViewQuery
}: EdgeDerivationOptions) => {
  const isEdgeConnecting = () =>
    readState('interactionSession').active?.kind === 'edgeConnect'

  const paths = (): EdgePathEntry[] =>
    edgeViewQuery.getPaths(
      readState('edgeConnect'),
      isEdgeConnecting(),
      readState('routingDrag')
    )

  const preview = (): EdgePreviewView => {
    const edgeConnect = readState('edgeConnect')
    const tool = readState('tool')
    const resolved = edgeViewQuery.getPreview(edgeConnect, isEdgeConnecting())
    return {
      from: resolved.showPreviewLine ? resolved.from : undefined,
      to: resolved.showPreviewLine ? resolved.to : undefined,
      snap: tool === 'edge' ? resolved.hover : undefined,
      reconnect: resolved.reconnect,
      showPreviewLine: resolved.showPreviewLine
    }
  }

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
    const activeDrag = readState('routingDrag').payload
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
