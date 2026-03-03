import type { Point, Viewport } from '@whiteboard/core/types'
import type { Size } from '../common/base'

export type ContainerRect = {
  left: number
  top: number
  width: number
  height: number
}

export type ViewportReadApi = {
  get: () => Viewport
  getZoom: () => number
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
  clientToScreen: (clientX: number, clientY: number) => Point
  clientToWorld: (clientX: number, clientY: number) => Point
  getScreenCenter: () => Point
  getContainerSize: () => Size
}

export type ViewportWriteApi = {
  setViewport: (viewport: Viewport) => void
  setContainerRect: (rect: ContainerRect) => void
}

export type ViewportApi = ViewportReadApi & ViewportWriteApi
