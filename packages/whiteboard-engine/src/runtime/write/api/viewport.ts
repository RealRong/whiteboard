import type { Commands } from '@engine-types/command/api'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { ViewportCommandsApi } from '@engine-types/write/commands'
import { panViewport, zoomViewport } from '@whiteboard/core/geometry'
import type { DispatchResult, Point, Viewport } from '@whiteboard/core/types'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../../config'

const invalid = (message: string): DispatchResult => ({
  ok: false,
  reason: 'invalid',
  message
})

export const viewport = ({
  instance
}: {
  instance: Pick<InternalInstance, 'mutate' | 'viewport'>
}): ViewportCommandsApi => {
  const readViewport = () => instance.viewport.get() ?? DEFAULT_DOCUMENT_VIEWPORT

  const applyViewport = (
    before: Viewport,
    after: Viewport
  ): Promise<DispatchResult> =>
    instance.mutate(
      [
        {
          type: 'viewport.update',
          before,
          after
        }
      ],
      'ui'
    )

  const set: Commands['viewport']['set'] = (viewport) => {
    if (!viewport.center) {
      return Promise.resolve(invalid('Missing viewport center.'))
    }
    if (!Number.isFinite(viewport.zoom) || viewport.zoom <= 0) {
      return Promise.resolve(invalid('Invalid viewport zoom.'))
    }
    return applyViewport(readViewport(), viewport)
  }

  const panBy: Commands['viewport']['panBy'] = (delta) => {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
      return Promise.resolve(invalid('Invalid pan delta.'))
    }
    const before = readViewport()
    return applyViewport(before, panViewport(before, delta))
  }

  const zoomBy: Commands['viewport']['zoomBy'] = (factor, anchor?: Point) => {
    if (!Number.isFinite(factor) || factor <= 0) {
      return Promise.resolve(invalid('Invalid zoom factor.'))
    }
    const before = readViewport()
    return applyViewport(before, zoomViewport(before, factor, anchor))
  }

  const zoomTo: Commands['viewport']['zoomTo'] = (zoom, anchor?: Point) => {
    const before = readViewport()
    if (before.zoom === 0) {
      return set({
        center: before.center,
        zoom
      })
    }
    return zoomBy(zoom / before.zoom, anchor)
  }

  const reset: Commands['viewport']['reset'] = () => set(DEFAULT_DOCUMENT_VIEWPORT)

  return {
    set,
    panBy,
    zoomBy,
    zoomTo,
    reset
  }
}
