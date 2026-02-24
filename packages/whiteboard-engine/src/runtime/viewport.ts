import {
  isSameViewport,
  viewportScreenToWorld,
  viewportWorldToScreen
} from '@whiteboard/core/geometry'
import type { Point, Viewport } from '@whiteboard/core/types'
import type { Size } from '@engine-types/common'
import type { ContainerRect, ViewportApi } from '@engine-types/viewport'
import { DEFAULT_DOCUMENT_VIEWPORT, DEFAULT_INTERNALS } from '../config'

const toContainerSize = (rect: ContainerRect): Size => ({
  width: rect.width,
  height: rect.height
})

const toScreenCenter = (size: Size): Point => ({
  x: size.width / 2,
  y: size.height / 2
})

const isSameRect = (a: ContainerRect, b: ContainerRect) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

const copyViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const copyRect = (rect: ContainerRect): ContainerRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height
})

export class ViewportRuntime implements ViewportApi {
  private viewport: Viewport = copyViewport(DEFAULT_DOCUMENT_VIEWPORT)
  private containerRect: ContainerRect = copyRect(DEFAULT_INTERNALS.containerRect)
  private containerSize: Size = toContainerSize(DEFAULT_INTERNALS.containerRect)
  private screenCenter: Point = toScreenCenter(this.containerSize)

  private updateDerivedFromRect = (rect: ContainerRect) => {
    this.containerRect = copyRect(rect)
    this.containerSize = toContainerSize(rect)
    this.screenCenter = toScreenCenter(this.containerSize)
  }

  get: ViewportApi['get'] = () => this.viewport

  getZoom: ViewportApi['getZoom'] = () => this.viewport.zoom

  screenToWorld: ViewportApi['screenToWorld'] = (point) =>
    viewportScreenToWorld(point, this.viewport, this.screenCenter)

  worldToScreen: ViewportApi['worldToScreen'] = (point) =>
    viewportWorldToScreen(point, this.viewport, this.screenCenter)

  clientToScreen: ViewportApi['clientToScreen'] = (clientX, clientY) => ({
    x: clientX - this.containerRect.left,
    y: clientY - this.containerRect.top
  })

  clientToWorld: ViewportApi['clientToWorld'] = (clientX, clientY) =>
    this.screenToWorld(this.clientToScreen(clientX, clientY))

  getScreenCenter: ViewportApi['getScreenCenter'] = () => this.screenCenter

  getContainerSize: ViewportApi['getContainerSize'] = () => this.containerSize

  setViewport: ViewportApi['setViewport'] = (nextViewport) => {
    if (isSameViewport(nextViewport, this.viewport)) return
    this.viewport = copyViewport(nextViewport)
  }

  setContainerRect: ViewportApi['setContainerRect'] = (nextRect) => {
    if (isSameRect(nextRect, this.containerRect)) return
    this.updateDerivedFromRect(nextRect)
  }
}
