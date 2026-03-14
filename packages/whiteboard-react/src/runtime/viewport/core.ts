import type { createStore } from 'jotai/vanilla'
import { isSameViewport, panViewport, zoomViewport } from '@whiteboard/core/geometry'
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
import {
  DEFAULT_VIEWPORT,
  viewportAtom
} from './atoms'
import type { ContainerRect } from './logic'

export type WhiteboardViewport = {
  get: () => Readonly<Viewport>
  subscribe: (listener: () => void) => () => void
  set: (viewport: Viewport) => void
  panBy: (delta: Point) => void
  zoomBy: (factor: number, anchor?: Point) => void
  zoomTo: (zoom: number, anchor?: Point) => void
  reset: () => void
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

export type ViewportCore = {
  viewport: WhiteboardViewport
  setRect: (rect: ContainerRect) => void
  setLimits: (limits: ViewportLimits) => void
}

export const createViewportCore = ({
  store
}: {
  store: ReturnType<typeof createStore>
}): ViewportCore => {
  let rect = EMPTY_CONTAINER_RECT
  let limits = DEFAULT_VIEWPORT_LIMITS
  const initial = normalizeViewport(copyViewport(store.get(viewportAtom) ?? DEFAULT_VIEWPORT), limits)

  const setViewport = (next: Viewport) => {
    const normalized = normalizeViewport(next, limits)
    const current = store.get(viewportAtom)
    if (isSameViewport(current, normalized)) return
    store.set(viewportAtom, normalized)
  }

  return {
    viewport: {
      get: () => store.get(viewportAtom),
      subscribe: (listener) => store.sub(viewportAtom, listener),
      set: setViewport,
      panBy: (delta) => {
        if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return
        setViewport(panViewport(store.get(viewportAtom), delta))
      },
      zoomBy: (factor, anchor) => {
        if (!Number.isFinite(factor) || factor <= 0) return
        setViewport(zoomViewport(store.get(viewportAtom), factor, anchor))
      },
      zoomTo: (zoom, anchor) => {
        if (!Number.isFinite(zoom) || zoom <= 0) return
        const current = store.get(viewportAtom)
        const factor = current.zoom === 0 ? zoom : zoom / current.zoom
        if (!Number.isFinite(factor) || factor <= 0) return
        setViewport(zoomViewport(current, factor, anchor))
      },
      reset: () => {
        setViewport(initial)
      },
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
          world: screenToWorldPoint(screen, store.get(viewportAtom), rect)
        }
      },
      screenToWorld: (point) =>
        screenToWorldPoint(point, store.get(viewportAtom), rect),
      worldToScreen: (point) =>
        worldToScreenPoint(point, store.get(viewportAtom), rect)
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
      setViewport(store.get(viewportAtom))
    }
  }
}

export type { ContainerRect } from './logic'
export { DEFAULT_VIEWPORT } from './atoms'
