import type {
  Editor
} from '../../types/editor'
import type {
  EditorInputInternals,
  EditorViewportRuntime
} from '../editor/types'
import type { InteractionCoordinator } from '../interaction'
import {
  resolvePointerDown,
  resolvePointerMove,
  resolvePointerUp,
  resolveWheelInput
} from './pointer'
import {
  type PointerSnapshotStore
} from './pointer/snapshot'
import type {
  PointerDown,
  PointerMove,
  PointerUp
} from './pointer'

type InputRouterHost = Pick<
  Editor,
  'read'
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

const toInteractionPointerInput = (
  input: PointerDown | PointerMove | PointerUp
) => ({
  pointerId: input.pointerId,
  button: input.button,
  buttons: input.buttons,
  detail: input.detail,
  client: input.point.client,
  screen: input.point.screen,
  world: input.point.world,
  pick: input.pick,
  altKey: input.altKey,
  shiftKey: input.shiftKey,
  ctrlKey: input.ctrlKey,
  metaKey: input.metaKey,
  modifiers: input.modifiers,
  samples: input.samples
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
    pointer.set({
      client: input.client,
      screen: input.screen,
      world: input.world
    })

    if (editor.interaction.busy.get()) {
      return {
        handled: false,
        continuePointer: false
      }
    }

    const resolved = resolvePointerDown(editor, input)
    const handled = runtime.interactions.start(resolved)
    return {
      handled,
      continuePointer: handled && editor.interaction.busy.get()
    }
  },
  pointerMove: (input) => {
    pointer.set({
      client: input.client,
      screen: input.screen,
      world: input.world
    })

    if (editor.interaction.busy.get()) {
      const resolved = resolvePointerMove(editor, input)
      return editor.interaction.handlePointerMove(
        toInteractionPointerInput(resolved)
      )
    }

    const resolved = resolvePointerMove(editor, input)

    runtime.passive.move(
      resolved,
      readPassiveContext(editor)
    )
    return false
  },
  pointerUp: (input) => {
    pointer.set({
      client: input.client,
      screen: input.screen,
      world: input.world
    })

    if (!editor.interaction.busy.get()) {
      return false
    }

    const resolved = resolvePointerUp(editor, input)
    return editor.interaction.handlePointerUp(
      toInteractionPointerInput(resolved)
    )
  },
  pointerCancel: (input) => {
    pointer.set(null)
    return editor.interaction.handlePointerCancel(input)
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
      client: resolved.client,
      screen: resolved.screen,
      world: resolved.world
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
        clientX: resolved.client.x,
        clientY: resolved.client.y
      },
      runtime.policy.get().wheelSensitivity
    )
    return true
  },
  keyDown: (input) => editor.interaction.handleKeyDown(input),
  keyUp: (input) => editor.interaction.handleKeyUp(input),
  blur: () => {
    pointer.set(null)
    runtime.passive.blur(
      readPassiveContext(editor)
    )
    editor.interaction.handleBlur()
  }
})
