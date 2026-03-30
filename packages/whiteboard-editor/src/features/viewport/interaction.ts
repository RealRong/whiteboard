import type { ValueStore } from '@whiteboard/engine'
import type { EditorRuntime } from '../../types/internal/editor'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../runtime/interaction'

type ViewportInputPolicy = {
  panEnabled: boolean
}

type ViewportPanState = {
  lastClient: {
    x: number
    y: number
  }
}

type ViewportPanInteractionDeps = Pick<
  EditorRuntime,
  'interaction' | 'read' | 'viewport'
> & {
  policy: Pick<ValueStore<ViewportInputPolicy>, 'get'>
}

const allowsLeftDrag = (
  editor: ViewportPanInteractionDeps
) => (
  editor.interaction.state.get().space
  || editor.read.tool.is('hand')
)

const updatePan = (
  editor: ViewportPanInteractionDeps,
  state: ViewportPanState,
  input: InteractionPointerInput
) => {
  const deltaX = input.client.x - state.lastClient.x
  const deltaY = input.client.y - state.lastClient.y
  if (deltaX === 0 && deltaY === 0) {
    return
  }

  state.lastClient = {
    x: input.client.x,
    y: input.client.y
  }
  editor.viewport.input.panScreenBy({
    x: -deltaX,
    y: -deltaY
  })

  if (input.raw.cancelable) {
    input.raw.preventDefault()
  }
}

export const createViewportPanInteraction = (
  editor: ViewportPanInteractionDeps
): InteractionRegistration<ViewportPanState> => ({
  key: 'viewport.pan',
  priority: 1000,
  mode: 'viewport-pan',
  can: (input) => {
    if (!editor.policy.get().panEnabled) {
      return null
    }

    if (input.ignoreInput) {
      return null
    }

    const middleDrag = input.event.button === 1 || (input.event.buttons & 4) === 4
    const leftDrag =
      (input.event.button === 0 || (input.event.buttons & 1) === 1)
      && allowsLeftDrag(editor)

    if (!middleDrag && !leftDrag) {
      return null
    }

    return {
      lastClient: {
        x: input.event.clientX,
        y: input.event.clientY
      }
    }
  },
  capture: (_state, input) => input.container,
  start: ({ input }) => {
    if (input.event.cancelable) {
      input.event.preventDefault()
    }
    input.event.stopPropagation()
  },
  move: ({ state }, input) => {
    updatePan(editor, state, input)
  },
  up: ({ session }, input) => {
    session.finish()
    if (input.raw.cancelable) {
      input.raw.preventDefault()
    }
  }
})
