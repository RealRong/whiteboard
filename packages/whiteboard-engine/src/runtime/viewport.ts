import type { Point, Viewport } from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import type { ViewportApi } from '@engine-types/instance/runtime'
import type { ContainerRect } from '@engine-types/instance/services'
import { DEFAULT_DOCUMENT_VIEWPORT, DEFAULT_INTERNALS } from '../config'

const toContainerSize = (rect: ContainerRect): Size => ({
  width: rect.width,
  height: rect.height
})

const toScreenCenter = (size: Size): Point => ({
  x: size.width / 2,
  y: size.height / 2
})

const isSameViewport = (a: Viewport, b: Viewport) =>
  a.zoom === b.zoom && a.center.x === b.center.x && a.center.y === b.center.y

const isSameRect = (a: ContainerRect, b: ContainerRect) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

export const createViewport = (): ViewportApi => {
  let viewport: Viewport = DEFAULT_DOCUMENT_VIEWPORT
  let containerRect: ContainerRect = DEFAULT_INTERNALS.containerRect
  let containerSize = toContainerSize(DEFAULT_INTERNALS.containerRect)
  let screenCenter = toScreenCenter(containerSize)

  const updateDerivedFromRect = (rect: ContainerRect) => {
    containerRect = rect
    containerSize = toContainerSize(rect)
    screenCenter = toScreenCenter(containerSize)
  }

  const screenToWorld = (point: Point): Point => ({
    x: (point.x - screenCenter.x) / viewport.zoom + viewport.center.x,
    y: (point.y - screenCenter.y) / viewport.zoom + viewport.center.y
  })

  const worldToScreen = (point: Point): Point => ({
    x: (point.x - viewport.center.x) * viewport.zoom + screenCenter.x,
    y: (point.y - viewport.center.y) * viewport.zoom + screenCenter.y
  })

  const clientToScreen = (clientX: number, clientY: number): Point => ({
    x: clientX - containerRect.left,
    y: clientY - containerRect.top
  })

  return {
    get: () => viewport,
    getZoom: () => viewport.zoom,
    screenToWorld,
    worldToScreen,
    clientToScreen,
    clientToWorld: (clientX, clientY) => screenToWorld(clientToScreen(clientX, clientY)),
    getScreenCenter: () => screenCenter,
    getContainerSize: () => containerSize,
    setViewport: (nextViewport) => {
      if (isSameViewport(nextViewport, viewport)) return
      viewport = nextViewport
    },
    setContainerRect: (nextRect) => {
      if (isSameRect(nextRect, containerRect)) return
      updateDerivedFromRect(nextRect)
    }
  }
}
