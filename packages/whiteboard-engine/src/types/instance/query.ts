import type {
  Point,
  Viewport
} from '@whiteboard/core/types'
import type { Size } from '../common/base'
import type {
  CanvasQueryContext,
  SnapQueryContext
} from '../read/indexer'

export type Query = {
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
  canvas: {
    nodeRects: CanvasQueryContext['all']
    nodeRect: CanvasQueryContext['byId']
    nodeIdsInRect: CanvasQueryContext['idsInRect']
  }
  snap: {
    candidates: SnapQueryContext['all']
    candidatesInRect: SnapQueryContext['inRect']
  }
}
