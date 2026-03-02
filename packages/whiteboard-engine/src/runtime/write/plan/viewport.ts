import type { InternalInstance } from '@engine-types/instance/engine'
import type { ViewportCommand } from '../model'
import type { Draft } from '../model'
import { ops } from '../model'
import { corePlan } from '@whiteboard/core/kernel'
import type { Viewport } from '@whiteboard/core/types'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../../config'

export const viewport = ({
  instance
}: {
  instance: Pick<InternalInstance, 'viewport'>
}) => {
  const readViewport = (): Viewport =>
    instance.viewport.get() ?? DEFAULT_DOCUMENT_VIEWPORT

  return (command: ViewportCommand): Draft => {
    if (command.type === 'set') {
      return ops(
        corePlan.viewport.set({
          before: readViewport(),
          viewport: command.viewport
        })
      )
    }

    if (command.type === 'panBy') {
      return ops(
        corePlan.viewport.panBy({
          before: readViewport(),
          delta: command.delta
        })
      )
    }

    if (command.type === 'zoomBy') {
      return ops(
        corePlan.viewport.zoomBy({
          before: readViewport(),
          factor: command.factor,
          anchor: command.anchor
        })
      )
    }

    if (command.type === 'zoomTo') {
      return ops(
        corePlan.viewport.zoomTo({
          before: readViewport(),
          zoom: command.zoom,
          anchor: command.anchor
        })
      )
    }

    return ops(
      corePlan.viewport.reset({
        before: readViewport(),
        viewport: DEFAULT_DOCUMENT_VIEWPORT
      })
    )
  }
}
