import type { InstanceConfig } from '@engine-types/instance/config'
import type { QueryGeometry } from '@engine-types/instance/query'
import {
  getAnchorFromPoint as getAnchorFromPointRaw,
  getNearestEdgeSegment as getNearestEdgeSegmentRaw
} from '../../kernel/query'

type Options = {
  config: InstanceConfig
}

export const createGeometry = ({
  config
}: Options): QueryGeometry => ({
  anchorFromPoint: (rect, rotation, point) =>
    getAnchorFromPointRaw(rect, rotation, point, {
      snapMin: config.edge.anchorSnapMin,
      snapRatio: config.edge.anchorSnapRatio
    }),
  nearestEdgeSegment: (pointWorld, pathPoints) =>
    getNearestEdgeSegmentRaw(pointWorld, pathPoints)
})
