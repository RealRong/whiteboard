import type { State } from '@engine-types/instance/state'
import type {
  EdgeEndpoints,
  EdgePathEntry,
  EdgePreviewView
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
  const emptyPreview: EdgePreviewView = {
    from: undefined,
    to: undefined,
    snap: undefined,
    reconnect: undefined,
    showPreviewLine: false
  }

  const paths = (): EdgePathEntry[] =>
    edgeViewQuery.getPaths()

  const preview = (): EdgePreviewView =>
    emptyPreview

  const selectedEndpoints = (): EdgeEndpoints | undefined => {
    const selectedEdgeId = readState('selection').selectedEdgeId
    if (!selectedEdgeId) return undefined
    const edge = edgeViewQuery.getEdge(selectedEdgeId)
    if (!edge) return undefined
    return edgeViewQuery.getEndpoints(edge)
  }

  return {
    paths,
    preview,
    selectedEndpoints
  }
}
