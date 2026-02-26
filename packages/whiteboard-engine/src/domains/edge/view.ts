import type { Edge, EdgeId } from '@whiteboard/core/types'
import { getAnchorPoint, getRectCenter } from '@whiteboard/core/geometry'
import { getAutoAnchorFromRect } from '@whiteboard/core/edge'
import type { Query } from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type { ProjectionCommit, ProjectionSnapshot } from '@engine-types/projection'
import type {
  EdgeEndpoints,
  EdgePathEntry,
  EdgePreviewView
} from '@engine-types/instance/view'
import { createEdgePathStore } from '../../runtime/query/EdgePath'

type Options = {
  readProjection: () => ProjectionSnapshot
  query: Query
  readState: State['read']
}

const createEdgeEndpointsResolver = (
  getNodeRect: Query['canvas']['nodeRect']
) => {
  const resolveEndpoints = (edge: Edge): EdgeEndpoints | undefined => {
    const sourceEntry = getNodeRect(edge.source.nodeId)
    const targetEntry = getNodeRect(edge.target.nodeId)
    if (!sourceEntry || !targetEntry) return undefined

    const sourceCenter = getRectCenter(sourceEntry.rect)
    const targetCenter = getRectCenter(targetEntry.rect)

    const sourceAuto = getAutoAnchorFromRect(
      sourceEntry.rect,
      sourceEntry.rotation,
      targetCenter
    )
    const targetAuto = getAutoAnchorFromRect(
      targetEntry.rect,
      targetEntry.rotation,
      sourceCenter
    )

    const sourceAnchor = edge.source.anchor ?? sourceAuto.anchor
    const targetAnchor = edge.target.anchor ?? targetAuto.anchor

    const sourcePoint = edge.source.anchor
      ? getAnchorPoint(sourceEntry.rect, sourceAnchor, sourceEntry.rotation)
      : sourceAuto.point
    const targetPoint = edge.target.anchor
      ? getAnchorPoint(targetEntry.rect, targetAnchor, targetEntry.rotation)
      : targetAuto.point

    return {
      source: {
        nodeId: sourceEntry.node.id,
        anchor: sourceAnchor,
        point: sourcePoint
      },
      target: {
        nodeId: targetEntry.node.id,
        anchor: targetAnchor,
        point: targetPoint
      }
    }
  }

  return resolveEndpoints
}

export const createEdgeViewStore = ({
  readProjection,
  query,
  readState
}: Options) => {
  const resolveEndpoints = createEdgeEndpointsResolver(query.canvas.nodeRect)
  const pathStore = createEdgePathStore({
    readProjection,
    getNodeRect: query.canvas.nodeRect,
    resolveEndpoints
  })

  const emptyPreview: EdgePreviewView = {
    from: undefined,
    to: undefined,
    snap: undefined,
    reconnect: undefined,
    showPreviewLine: false
  }

  const getEdge = (edgeId: EdgeId): Edge | undefined =>
    pathStore.getEdge(edgeId)

  const getEndpoints = (edge: Edge): EdgeEndpoints | undefined =>
    resolveEndpoints(edge)

  const applyCommit = (commit: ProjectionCommit) => {
    pathStore.applyCommit(commit)
  }

  const paths = (): EdgePathEntry[] =>
    pathStore.getEntries()

  const preview = (): EdgePreviewView =>
    emptyPreview

  const selectedEndpoints = (): EdgeEndpoints | undefined => {
    const selectedEdgeId = readState('selection').selectedEdgeId
    if (!selectedEdgeId) return undefined
    const edge = getEdge(selectedEdgeId)
    if (!edge) return undefined
    return getEndpoints(edge)
  }

  return {
    applyCommit,
    paths,
    preview,
    selectedEndpoints
  }
}

export type EdgeViewStore = ReturnType<typeof createEdgeViewStore>
