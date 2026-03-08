import {
  viewportScreenToWorld,
  viewportWorldToScreen
} from '@whiteboard/core/geometry'
import type { Point, Viewport } from '@whiteboard/core/types'

export type ContainerRect = {
  left: number
  top: number
  width: number
  height: number
}

export type ViewportSize = {
  width: number
  height: number
}

export type ViewportRuntime = {
  get: () => Readonly<Viewport>
  getZoom: () => number
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
  clientToScreen: (clientX: number, clientY: number) => Point
  clientToWorld: (clientX: number, clientY: number) => Point
  getScreenCenter: () => Point
  getContainerSize: () => ViewportSize
  setContainerRect: (rect: ContainerRect) => void
}

const EMPTY_RECT: ContainerRect = {
  left: 0,
  top: 0,
  width: 0,
  height: 0
}

const copyRect = (rect: ContainerRect): ContainerRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height
})

const toSize = (rect: ContainerRect): ViewportSize => ({
  width: rect.width,
  height: rect.height
})

const toScreenCenter = (size: ViewportSize): Point => ({
  x: size.width / 2,
  y: size.height / 2
})

export const createViewportRuntime = ({
  readViewport
}: {
  readViewport: () => Viewport
}): ViewportRuntime => {
  let containerRect = copyRect(EMPTY_RECT)
  let containerSize = toSize(containerRect)
  let screenCenter = toScreenCenter(containerSize)

  const setContainerRect = (nextRect: ContainerRect) => {
    if (
      containerRect.left === nextRect.left
      && containerRect.top === nextRect.top
      && containerRect.width === nextRect.width
      && containerRect.height === nextRect.height
    ) {
      return
    }
    containerRect = copyRect(nextRect)
    containerSize = toSize(containerRect)
    screenCenter = toScreenCenter(containerSize)
  }

  const clientToScreen = (clientX: number, clientY: number): Point => ({
    x: clientX - containerRect.left,
    y: clientY - containerRect.top
  })

  const screenToWorld = (point: Point): Point =>
    viewportScreenToWorld(point, readViewport(), screenCenter)

  const worldToScreen = (point: Point): Point =>
    viewportWorldToScreen(point, readViewport(), screenCenter)

  return {
    get: () => readViewport(),
    getZoom: () => readViewport().zoom,
    screenToWorld,
    worldToScreen,
    clientToScreen,
    clientToWorld: (clientX, clientY) => screenToWorld(clientToScreen(clientX, clientY)),
    getScreenCenter: () => screenCenter,
    getContainerSize: () => containerSize,
    setContainerRect
  }
}
