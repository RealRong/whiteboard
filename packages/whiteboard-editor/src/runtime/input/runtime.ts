import type {
  Editor,
  EditorRuntime
} from '../editor/types'
import {
  resolvePointerDown,
  resolvePointerMove,
  resolveWheelInput
} from './pointer'
import {
  readPointerSnapshot,
  type PointerSnapshotStore
} from './pointerSnapshot'

type InputRuntimeDeps = Pick<
  EditorRuntime,
  'commands' | 'interaction' | 'read' | 'state' | 'viewport'
> & {
  internals: Pick<EditorRuntime['internals'], 'input'>
}

const readPassiveContext = (
  editor: Pick<EditorRuntime, 'interaction' | 'read'>
) => ({
  mode: editor.interaction.mode.get(),
  tool: editor.read.tool.get()
})

export const createInputRuntime = ({
  editor,
  pointer
}: {
  editor: InputRuntimeDeps
  pointer: PointerSnapshotStore
}): Editor['input'] => ({
  cancel: () => {
    pointer.set(null)
    editor.internals.input.passive.cancel()
    editor.internals.input.interactions.cancel()
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

    return editor.internals.input.interactions.start(resolved)
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

    editor.internals.input.passive.move(
      resolved,
      readPassiveContext(editor)
    )
  },
  pointerLeave: () => {
    pointer.set(null)
    editor.internals.input.passive.leave(
      readPassiveContext(editor)
    )
  },
  wheel: (input) => {
    if (!editor.internals.input.policy.get().wheelEnabled) {
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

    const handledByPassive = editor.internals.input.passive.wheel(
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
      editor.internals.input.policy.get().wheelSensitivity
    )
    return true
  },
  keyDown: (input) => editor.interaction.handleKeyDown(input.event),
  keyUp: (input) => editor.interaction.handleKeyUp(input.event),
  blur: () => {
    pointer.set(null)
    editor.internals.input.passive.blur(
      readPassiveContext(editor)
    )
    editor.interaction.handleBlur()
  }
})
