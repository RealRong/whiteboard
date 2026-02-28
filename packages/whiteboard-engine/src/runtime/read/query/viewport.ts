import type { QueryViewport } from '@engine-types/instance/query'
import type { ViewportApi } from '@engine-types/viewport'

type Options = {
  viewport: ViewportApi
}

export const viewport = ({ viewport }: Options): QueryViewport => ({
  get: viewport.get,
  getZoom: viewport.getZoom,
  screenToWorld: viewport.screenToWorld,
  worldToScreen: viewport.worldToScreen,
  clientToScreen: viewport.clientToScreen,
  clientToWorld: viewport.clientToWorld,
  getScreenCenter: viewport.getScreenCenter,
  getContainerSize: viewport.getContainerSize
})
