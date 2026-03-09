import {
  isSameViewport,
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
  getCommitted: () => Readonly<Viewport>
  subscribe: (listener: () => void) => () => void
  getZoom: () => number
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
  clientToScreen: (clientX: number, clientY: number) => Point
  clientToWorld: (clientX: number, clientY: number) => Point
  getScreenCenter: () => Point
  getContainerSize: () => ViewportSize
  setContainerRect: (rect: ContainerRect) => void
}

export type ViewportRuntimeControl = ViewportRuntime & {
  commit: (viewport: Viewport) => boolean
}

export const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
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

const cloneViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const assertViewport = (viewport: Viewport): Viewport => {
  if (!viewport || !viewport.center) {
    throw new Error('Viewport center is required.')
  }
  if (!Number.isFinite(viewport.center.x) || !Number.isFinite(viewport.center.y)) {
    throw new Error('Viewport center must be finite.')
  }
  if (!Number.isFinite(viewport.zoom) || viewport.zoom <= 0) {
    throw new Error('Viewport zoom must be a positive finite number.')
  }
  return viewport
}

export const createViewportRuntime = ({
  initialViewport = DEFAULT_VIEWPORT,
  readEffectiveViewport
}: {
  initialViewport?: Viewport
  readEffectiveViewport: () => Viewport
}): ViewportRuntimeControl => {
  let containerRect = copyRect(EMPTY_RECT)
  let containerSize = toSize(containerRect)
  let screenCenter = toScreenCenter(containerSize)
  let committedViewport = cloneViewport(assertViewport(initialViewport))
  const listeners = new Set<() => void>()

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
    viewportScreenToWorld(point, readEffectiveViewport(), screenCenter)

  const worldToScreen = (point: Point): Point =>
    viewportWorldToScreen(point, readEffectiveViewport(), screenCenter)

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const commit = (viewport: Viewport) => {
    const nextViewport = cloneViewport(assertViewport(viewport))
    if (isSameViewport(committedViewport, nextViewport)) {
      return false
    }
    committedViewport = nextViewport
    listeners.forEach((listener) => {
      listener()
    })
    return true
  }

  return {
    get: () => readEffectiveViewport(),
    getCommitted: () => committedViewport,
    subscribe,
    commit,
    getZoom: () => readEffectiveViewport().zoom,
    screenToWorld,
    worldToScreen,
    clientToScreen,
    clientToWorld: (clientX, clientY) => screenToWorld(clientToScreen(clientX, clientY)),
    getScreenCenter: () => screenCenter,
    getContainerSize: () => containerSize,
    setContainerRect
  }
}
