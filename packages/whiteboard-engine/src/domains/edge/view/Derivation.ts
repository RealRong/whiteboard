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
  const isEdgeConnecting = () =>
    readRender('interactionSession').active?.kind === 'edgeConnect'

  const paths = (): EdgePathEntry[] =>
    edgeViewQuery.getPaths(
      readRender('edgeConnect'),
      isEdgeConnecting(),
      readRender('routingDrag')
    )

  const preview = (): EdgePreviewView => {
    const edgeConnect = readRender('edgeConnect')
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
