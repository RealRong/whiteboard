import type { InternalInstance } from '@engine-types/instance/engine'
import type { WriteCommandMap } from '@engine-types/command/api'
import type { Draft } from '../draft'
import { ops } from '../draft'
import { corePlan } from '@whiteboard/core/kernel'
import type { Viewport } from '@whiteboard/core/types'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../../../../config'

type ViewportCommand = WriteCommandMap['viewport']

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
          viewport: command.viewport
        })
      )
    }

    if (command.type === 'panBy') {
      return ops(
        corePlan.viewport.panBy({
          current: readViewport(),
          delta: command.delta
        })
      )
    }

    if (command.type === 'zoomBy') {
      return ops(
        corePlan.viewport.zoomBy({
          current: readViewport(),
          factor: command.factor,
          anchor: command.anchor
        })
      )
    }

    if (command.type === 'zoomTo') {
      return ops(
        corePlan.viewport.zoomTo({
          current: readViewport(),
          zoom: command.zoom,
          anchor: command.anchor
        })
      )
    }

    return ops(
      corePlan.viewport.reset({
        viewport: DEFAULT_DOCUMENT_VIEWPORT
      })
    )
  }
}
