import type {
  Editor
} from '../../types/editor'
import type {
  EditorInputInternals,
  EditorViewportRuntime
} from '../../types/internal/editor'
import type { InteractionCoordinator } from '../interaction'
import {
  resolvePointerDown,
  resolvePointerMove,
  resolveWheelInput
} from './pointer'
import {
  readPointerSnapshot,
  type PointerSnapshotStore
} from './pointer/snapshot'

type InputRouterHost = Pick<
  Editor,
  'commands' | 'read' | 'state'
> & {
  interaction: InteractionCoordinator
  viewport: EditorViewportRuntime
}

const readPassiveContext = (
  editor: Pick<InputRouterHost, 'interaction' | 'read'>
) => ({
  mode: editor.interaction.mode.get(),
  tool: editor.read.tool.get()
})

export const createInputRouter = ({
  editor,
  runtime,
  pointer
}: {
  editor: InputRouterHost
  runtime: EditorInputInternals
  pointer: PointerSnapshotStore
}): Editor['input'] => ({
  cancel: () => {
    pointer.set(null)
    runtime.passive.cancel()
    editor.interaction.cancel()
  },
  pointerDown: (input) => {
    pointer.set(readPointerSnapshot(editor.viewport, input.event))

    if (editor.interaction.busy.get()) {
      return false
    }

    const resolved = resolvePointerDown(
      editor,
      input.container,
      input.event
    )

    if (resolved.frameExit) {
      editor.commands.frame.exit()
    }

    return runtime.interactions.start(resolved)
  },
  pointerMove: (input) => {
    pointer.set(readPointerSnapshot(editor.viewport, input.event))

    if (editor.interaction.busy.get()) {
      return
    }

    const resolved = resolvePointerMove(
      editor,
      input.container,
      input.event
    )

    runtime.passive.move(
      resolved,
      readPassiveContext(editor)
    )
  },
  pointerLeave: () => {
    pointer.set(null)
    runtime.passive.leave(
      readPassiveContext(editor)
    )
  },
  wheel: (input) => {
    if (!runtime.policy.get().wheelEnabled) {
      return false
    }

    const resolved = resolveWheelInput(editor, input)
    pointer.set({
      client: resolved.point.client,
      screen: resolved.point.screen,
      world: resolved.point.world
    })

    if (editor.interaction.busy.get()) {
      return true
    }

    const handledByPassive = runtime.passive.wheel(
      resolved,
      readPassiveContext(editor)
    )
    if (handledByPassive) {
      return true
    }

    editor.viewport.input.wheel(
      {
        deltaX: resolved.deltaX,
        deltaY: resolved.deltaY,
        ctrlKey: resolved.ctrlKey,
        metaKey: resolved.metaKey,
        clientX: resolved.point.client.x,
        clientY: resolved.point.client.y
      },
      runtime.policy.get().wheelSensitivity
    )
    return true
  },
  keyDown: (input) => editor.interaction.handleKeyDown(input.event),
  keyUp: (input) => editor.interaction.handleKeyUp(input.event),
  blur: () => {
    pointer.set(null)
    runtime.passive.blur(
      readPassiveContext(editor)
    )
    editor.interaction.handleBlur()
  }
})
