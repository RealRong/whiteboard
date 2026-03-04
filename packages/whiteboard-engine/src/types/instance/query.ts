import type {
  Document,
  EdgeId,
  Point,
  Rect,
  Viewport
} from '@whiteboard/core/types'
import type { Size } from '../common/base'
import type { InstanceConfig } from './config'
import type {
  EdgeEndpoints,
  EdgeConnectAnchorResult
} from './read'
import type {
  CanvasQueryContext,
  SnapQueryContext
} from '../read/indexer'

export type Query = {
  doc: {
    get: () => Readonly<Document>
  }
  viewport: {
    get: () => Viewport
    getZoom: () => number
    screenToWorld: (point: Point) => Point
    worldToScreen: (point: Point) => Point
    clientToScreen: (clientX: number, clientY: number) => Point
    clientToWorld: (clientX: number, clientY: number) => Point
    getScreenCenter: () => Point
    getContainerSize: () => Size
  }
  config: {
    get: () => InstanceConfig
  }
  canvas: {
    nodeRects: CanvasQueryContext['all']
    nodeRect: CanvasQueryContext['byId']
    nodeIdsInRect: CanvasQueryContext['idsInRect']
  }
  snap: {
    candidates: SnapQueryContext['all']
    candidatesInRect: SnapQueryContext['inRect']
  }
  geometry: {
    anchorFromPoint: (rect: Rect, rotation: number, point: Point) => EdgeConnectAnchorResult
  }
  edgeEndpointsById: (edgeId: EdgeId) => EdgeEndpoints | undefined
}
