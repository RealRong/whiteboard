import type { ValueStore } from '@whiteboard/engine'
import type { EditorRuntime } from '../../types/internal/editor'
import {
  createInteractionSessionSlot,
  type InteractionDriver
} from '../../runtime/interaction'
import type { PointerDown } from '../../runtime/input/pointer'

type ViewportInputPolicy = {
  panEnabled: boolean
}

type ViewportPanDriverDeps = Pick<
  EditorRuntime,
  'interaction' | 'read' | 'viewport'
> & {
  policy: Pick<ValueStore<ViewportInputPolicy>, 'get'>
}

export const createViewportPanDriver = (
  editor: ViewportPanDriverDeps
): InteractionDriver<PointerDown> => {
  const interaction = createInteractionSessionSlot<{
    lastX: number
    lastY: number
  }>({
    interaction: editor.interaction
  })

  const readPan = () => interaction.getActive()

  return {
    kind: 'viewport.pan',
    priority: 1000,
    resolve: (input) => {
      if (!editor.policy.get().panEnabled) {
        return null
      }

      if (input.ignoreInput) {
        return null
      }

      const middleDrag = input.event.button === 1 || (input.event.buttons & 4) === 4
      const leftDrag =
        (input.event.button === 0 || (input.event.buttons & 1) === 1)
        && (editor.interaction.state.get().space || editor.read.tool.is('hand'))

      return middleDrag || leftDrag
        ? input
        : null
    },
    start: (input) => {
      const nextSession = interaction.start({
        mode: 'viewport-pan',
        pointerId: input.event.pointerId,
        capture: input.container,
        move: (event) => {
          const pan = readPan()
          if (!pan) {
            return
          }

          const deltaX = event.clientX - pan.lastX
          const deltaY = event.clientY - pan.lastY
          if (deltaX === 0 && deltaY === 0) {
            return
          }

          pan.lastX = event.clientX
          pan.lastY = event.clientY
          editor.viewport.input.panScreenBy({
            x: -deltaX,
            y: -deltaY
          })

          if (event.cancelable) {
            event.preventDefault()
          }
        },
        up: (event, interactionSession) => {
          const pan = readPan()
          if (!pan) {
            return
          }

          interactionSession.finish()
          if (event.cancelable) {
            event.preventDefault()
          }
        }
      })
      if (!nextSession) {
        return false
      }

      interaction.setActive({
        lastX: input.event.clientX,
        lastY: input.event.clientY
      })

      if (input.event.cancelable) {
        input.event.preventDefault()
      }
      input.event.stopPropagation()
      return true
    },
    cancel: () => {
      interaction.cancel()
    }
  }
}
