import type { Point, Viewport } from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import type { ContainerRect, ViewportApi } from '@engine-types/instance'

const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

const DEFAULT_CONTAINER_RECT: ContainerRect = {
  left: 0,
  top: 0,
  width: 0,
  height: 0
}

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
  let viewport = DEFAULT_VIEWPORT
  let containerRect = DEFAULT_CONTAINER_RECT
  let containerSize = toContainerSize(DEFAULT_CONTAINER_RECT)
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
