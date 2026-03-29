import type { ValueStore } from '@whiteboard/engine'
import type { EditorRuntime } from '../../runtime/editor/types'
import type { InteractionDriver } from '../../runtime/interaction/driver'
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
  let pan: {
    lastX: number
    lastY: number
  } | null = null
  let session: ReturnType<typeof editor.interaction.start> = null

  const clear = () => {
    pan = null
    session = null
  }

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
      const nextSession = editor.interaction.start({
        mode: 'viewport-pan',
        pointerId: input.event.pointerId,
        capture: input.container,
        cleanup: clear,
        move: (event) => {
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

      pan = {
        lastX: input.event.clientX,
        lastY: input.event.clientY
      }
      session = nextSession

      if (input.event.cancelable) {
        input.event.preventDefault()
      }
      input.event.stopPropagation()
      return true
    },
    cancel: () => {
      session?.cancel()
      if (!session) {
        clear()
      }
    }
  }
}
