import { useMemo } from 'react'
import type { RefObject } from 'react'
import type { WhiteboardInstance } from 'types/instance'
import type { ViewportConfig } from 'types/common'
import { useViewportControls } from './useViewportControls'

type Options = {
  instance: WhiteboardInstance
  containerRef: RefObject<HTMLElement | null>
  config?: ViewportConfig
}

export const useViewportInteraction = ({ instance, containerRef, config }: Options) => {
  const handlers = useViewportControls({
    instance,
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
