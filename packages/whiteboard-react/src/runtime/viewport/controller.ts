import { isSameViewport, panViewport, zoomViewport } from '@whiteboard/core/geometry'
import type { ValueStore } from '@whiteboard/core/runtime'
import type { Point, Viewport } from '@whiteboard/core/types'
import {
  clientToScreenPoint,
  DEFAULT_VIEWPORT_LIMITS,
  EMPTY_CONTAINER_RECT,
  copyViewport,
  normalizeViewport,
  normalizeViewportLimits,
  screenToWorldPoint,
  type ViewportLimits,
  worldToScreenPoint
} from './logic'
import type { ContainerRect } from './logic'

export const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

export type ViewportController = {
  get: () => Readonly<Viewport>
  subscribe: (listener: () => void) => () => void
  set: (viewport: Viewport) => void
  panBy: (delta: Point) => void
  zoomBy: (factor: number, anchor?: Point) => void
  zoomTo: (zoom: number, anchor?: Point) => void
  reset: () => void
  size: () => {
    width: number
    height: number
  }
  clientToScreen: (clientX: number, clientY: number) => Point
  pointer: (event: {
    clientX: number
    clientY: number
  }) => ViewportPointer
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
}

export type ViewportPointer = {
  client: Point
  screen: Point
  world: Point
}

export type ViewportRuntime = {
  viewport: ViewportController
  setRect: (rect: ContainerRect) => void
  setLimits: (limits: ViewportLimits) => void
}

export const createViewportRuntime = ({
  state
}: {
  state: ValueStore<Viewport>
}): ViewportRuntime => {
  let rect = EMPTY_CONTAINER_RECT
  let limits = DEFAULT_VIEWPORT_LIMITS
  const initial = normalizeViewport(copyViewport(state.get() ?? DEFAULT_VIEWPORT), limits)

  const setViewport = (next: Viewport) => {
    const normalized = normalizeViewport(next, limits)
    const current = state.get()
    if (isSameViewport(current, normalized)) return
    state.set(normalized)
  }

  return {
    viewport: {
      get: () => state.get(),
      subscribe: (listener) => state.subscribe(listener),
      set: setViewport,
      panBy: (delta) => {
        if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return
        setViewport(panViewport(state.get(), delta))
      },
      zoomBy: (factor, anchor) => {
        if (!Number.isFinite(factor) || factor <= 0) return
        setViewport(zoomViewport(state.get(), factor, anchor))
      },
      zoomTo: (zoom, anchor) => {
        if (!Number.isFinite(zoom) || zoom <= 0) return
        const current = state.get()
        const factor = current.zoom === 0 ? zoom : zoom / current.zoom
        if (!Number.isFinite(factor) || factor <= 0) return
        setViewport(zoomViewport(current, factor, anchor))
      },
      reset: () => {
        setViewport(initial)
      },
      size: () => ({
        width: rect.width,
        height: rect.height
      }),
      clientToScreen: (clientX, clientY) =>
        clientToScreenPoint(clientX, clientY, rect),
      pointer: (event) => {
        const client = {
          x: event.clientX,
          y: event.clientY
        }
        const screen = clientToScreenPoint(client.x, client.y, rect)

        return {
          client,
          screen,
          world: screenToWorldPoint(screen, state.get(), rect)
        }
      },
      screenToWorld: (point) =>
        screenToWorldPoint(point, state.get(), rect),
      worldToScreen: (point) =>
        worldToScreenPoint(point, state.get(), rect)
    },
    setRect: (next) => {
      if (
        rect.left === next.left
        && rect.top === next.top
        && rect.width === next.width
        && rect.height === next.height
      ) {
        return
      }
      rect = next
    },
    setLimits: (next) => {
      const normalized = normalizeViewportLimits(next)
      if (
        limits.minZoom === normalized.minZoom
        && limits.maxZoom === normalized.maxZoom
      ) {
        return
      }
      limits = normalized
      setViewport(state.get())
    }
  }
}

export type { ContainerRect } from './logic'
