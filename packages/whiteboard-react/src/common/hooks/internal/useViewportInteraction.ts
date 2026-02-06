import { useMemo } from 'react'
import type { RefObject } from 'react'
import type { Core, Point, Viewport } from '@whiteboard/core'
import type { ViewportConfig } from '../../types'
import { useViewportControls } from './useViewportControls'

type Options = {
  core: Core
  viewport: Viewport
  screenToWorld: (point: Point) => Point
  containerRef: RefObject<HTMLElement>
  config?: ViewportConfig
}

export const useViewportInteraction = ({ core, viewport, screenToWorld, containerRef, config }: Options) => {
  const handlers = useViewportControls({
    core,
    viewport,
    screenToWorld,
    containerRef,
    minZoom: config?.minZoom,
    maxZoom: config?.maxZoom,
    enablePan: config?.enablePan,
    enableWheel: config?.enableWheel
  })

  const wheelHandler = useMemo(() => handlers.onWheel, [handlers])

  return {
    viewportHandlers: handlers,
    onWheel: wheelHandler
  }
}
