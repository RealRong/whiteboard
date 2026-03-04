import type {
  Document,
  Edge,
  EdgeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import type { EdgeEndpoints } from '@engine-types/instance/read'
import type { Query } from '@engine-types/instance/query'
import type { Indexer } from '@engine-types/read/indexer'
import type { Deps as ReadDeps } from '@engine-types/read/deps'
import {
  getAnchorFromPoint as getAnchorFromPointRaw,
  getNearestEdgeSegment as getNearestEdgeSegmentRaw,
  resolveEdgePathFromRects
} from '@whiteboard/core/edge'
import { DEFAULT_TUNING } from '../../../config'

type QueryDeps = Pick<ReadDeps, 'readDoc' | 'viewport' | 'config'> & {
  indexes: Indexer
}

export const query = ({
  readDoc,
  viewport,
  config,
  indexes
}: QueryDeps): Query => {
  let edgeMapDocRef: Readonly<Document> | undefined
  let edgeMap = new Map<EdgeId, Edge>()

  const resolveEdgeById = (edgeId: EdgeId): Edge | undefined => {
    const doc = readDoc()
    if (edgeMapDocRef !== doc) {
      edgeMapDocRef = doc
      edgeMap = new Map(doc.edges.map((edge) => [edge.id, edge]))
    }
    return edgeMap.get(edgeId)
  }

  const getEdgeEndpointsById: Query['edgeEndpointsById'] = (edgeId) => {
    const edge = resolveEdgeById(edgeId)
    if (!edge) return undefined

    const source = indexes.query.canvas.byId(edge.source.nodeId)
    const target = indexes.query.canvas.byId(edge.target.nodeId)
    if (!source || !target) return undefined

    const resolved = resolveEdgePathFromRects({
      edge,
      source: {
        rect: source.rect,
        rotation: source.rotation
      },
      target: {
        rect: target.rect,
        rotation: target.rotation
      }
    })

    const endpoints: EdgeEndpoints = {
      source: {
        nodeId: edge.source.nodeId,
        anchor: resolved.endpoints.source.anchor,
        point: resolved.endpoints.source.point
      },
      target: {
        nodeId: edge.target.nodeId,
        anchor: resolved.endpoints.target.anchor,
        point: resolved.endpoints.target.point
      }
    }
    return endpoints
  }

  const anchorOptions = {
    snapMin: config.edge.anchorSnapMin,
    snapRatio: config.edge.anchorSnapRatio,
    anchorOffset: DEFAULT_TUNING.edge.anchorOffset
  }

  return {
    doc: { get: () => readDoc() as Readonly<Document> },
    viewport,
    config: { get: () => config },
    canvas: {
      nodeRects: indexes.query.canvas.all,
      nodeRect: indexes.query.canvas.byId,
      nodeIdsInRect: indexes.query.canvas.idsInRect
    },
    snap: {
      candidates: indexes.query.snap.all,
      candidatesInRect: indexes.query.snap.inRect
    },
    geometry: {
      anchorFromPoint: (rect: Rect, rotation: number, point: Point) =>
        getAnchorFromPointRaw(rect, rotation, point, anchorOptions),
      nearestEdgeSegment: (pointWorld: Point, pathPoints: Point[]) =>
        getNearestEdgeSegmentRaw(pointWorld, pathPoints)
    },
    edgeEndpointsById: getEdgeEndpointsById
  }
}
