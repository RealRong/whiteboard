import type { Document } from '@whiteboard/core/types'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { ViewportApi } from '@engine-types/viewport'
import {
  getAnchorFromPoint as getAnchorFromPointRaw,
  getNearestEdgeSegment as getNearestEdgeSegmentRaw
} from '@whiteboard/core/edge'
import { DEFAULT_TUNING } from '../../config'
import type { ReadIndexRuntime } from './indexRuntime'

type Options = {
  readDoc: () => Document
  viewport: ViewportApi
  config: InstanceConfig
  indexes: ReadIndexRuntime
}

export const queryFactory = ({
  readDoc,
  viewport,
  config,
  indexes
}: Options): Query => ({
  doc: { get: readDoc },
  viewport: {
    get: viewport.get,
    getZoom: viewport.getZoom,
    screenToWorld: viewport.screenToWorld,
    worldToScreen: viewport.worldToScreen,
    clientToScreen: viewport.clientToScreen,
    clientToWorld: viewport.clientToWorld,
    getScreenCenter: viewport.getScreenCenter,
    getContainerSize: viewport.getContainerSize
  },
  config: { get: () => config },
  canvas: {
    nodeRects: indexes.query.nodeRects,
    nodeRect: indexes.query.nodeRect,
    nodeIdsInRect: indexes.query.nodeIdsInRect
  },
  snap: {
    candidates: indexes.query.snapCandidates,
    candidatesInRect: indexes.query.snapCandidatesInRect
  },
  geometry: {
    anchorFromPoint: (rect, rotation, point) =>
      getAnchorFromPointRaw(rect, rotation, point, {
        snapMin: config.edge.anchorSnapMin,
        snapRatio: config.edge.anchorSnapRatio,
        anchorOffset: DEFAULT_TUNING.edge.anchorOffset
      }),
    nearestEdgeSegment: (pointWorld, pathPoints) =>
      getNearestEdgeSegmentRaw(pointWorld, pathPoints)
  }
})
