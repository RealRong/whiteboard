import type { Point, Rect } from '@whiteboard/core/types'
import type { Query } from '@engine-types/instance/query'
import type { Indexer } from '@engine-types/read/indexer'
import type { Deps as ReadDeps } from '@engine-types/read/deps'
import {
  getAnchorFromPoint as getAnchorFromPointRaw,
  getNearestEdgeSegment as getNearestEdgeSegmentRaw
} from '@whiteboard/core/edge'
import { DEFAULT_TUNING } from '../../config'

type QueryDeps = Pick<ReadDeps, 'readDoc' | 'viewport' | 'config'> & {
  indexes: Indexer
}

export const query = ({
  readDoc,
  viewport,
  config,
  indexes
}: QueryDeps): Query => {
  const anchorOptions = {
    snapMin: config.edge.anchorSnapMin,
    snapRatio: config.edge.anchorSnapRatio,
    anchorOffset: DEFAULT_TUNING.edge.anchorOffset
  }

  return {
    doc: { get: readDoc },
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
    }
  }
}
