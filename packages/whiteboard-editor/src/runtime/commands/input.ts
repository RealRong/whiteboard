import type {
  Editor,
  EditorRuntime
} from '../editor/types'
import { handlePointerDown } from '../input/pointer'
import {
  readPointerSnapshot,
  type PointerSnapshotStore
} from '../input/pointerSnapshot'

export const createInputCommands = ({
  editor,
  pointer
}: {
  editor: Pick<EditorRuntime, 'commands' | 'read' | 'state' | 'host' | 'viewport'>
  pointer: PointerSnapshotStore
}): Editor['commands']['input'] => {
  const cancel = () => {
    pointer.set(null)
    editor.host.draw.cancel()
    editor.host.edge.input.cancel()
    editor.host.selection.gesture.cancel()
    editor.host.node.transform.cancel()
    editor.host.mindmap.controller.cancel()
  }

  return {
    cancel,
    pointerDown: (input) => {
      pointer.set(readPointerSnapshot(editor.viewport, input.event))
      return handlePointerDown(
        editor,
        input.container,
        input.event
      )
    },
    pointerMove: (input) => {
      pointer.set(readPointerSnapshot(editor.viewport, input.event))
      editor.host.edge.input.pointerMove(input.event)
    },
    pointerLeave: () => {
      pointer.set(null)
      editor.host.edge.input.pointerLeave()
    },
    keyDown: (input) => editor.host.interaction.handleKeyDown(input.event),
    keyUp: (input) => editor.host.interaction.handleKeyUp(input.event),
    blur: () => {
      pointer.set(null)
      editor.host.edge.input.pointerLeave()
      editor.host.interaction.handleBlur()
    }
  }
}
