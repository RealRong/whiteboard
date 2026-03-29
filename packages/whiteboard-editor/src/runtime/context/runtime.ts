import type { ValueStore } from '@whiteboard/engine'
import type { Editor } from '../editor/types'
import type { NodeRegistry } from '../../types/node'
import {
  readContextOpen,
  resolveContextTarget
} from '../input/pointer'
import { readContextMenuView } from './view'
import type {
  ContextDismissMode,
  ContextMenuSession,
  ContextMenuView,
  ContextOpenInput,
  ContextRuntime
} from './types'

type ContextRuntimeHost = Pick<Editor, 'commands' | 'read' | 'state'> & {
  registry: Pick<NodeRegistry, 'get'>
}

const writeSelection = (
  editor: Pick<Editor, 'commands'>,
  target: ContextMenuSession['restoreSelection']
) => {
  if (target.nodeIds.length > 0 || target.edgeIds.length > 0) {
    editor.commands.selection.replace({
      nodeIds: target.nodeIds,
      edgeIds: target.edgeIds
    })
    return
  }

  editor.commands.selection.clear()
}

export const createContextRuntime = (
  editor: ContextRuntimeHost,
  menu: ValueStore<ContextMenuView | null>
): ContextRuntime => {
  let session: ContextMenuSession | null = null

  const clear = () => {
    session = null
    menu.set(null)
  }

  const dismiss = (
    mode: ContextDismissMode
  ) => {
    const current = session
    clear()

    if (mode === 'dismiss' && current) {
      writeSelection(editor, current.restoreSelection)
    }
  }

  const open = (
    input: ContextOpenInput
  ) => {
    const result = readContextOpen(editor, input.pointer)
    if (!result) {
      clear()
      return false
    }

    const selection = editor.read.selection.get().target

    if (result.leaveFrame) {
      editor.commands.frame.exit()
    }

    const target = resolveContextTarget(editor, result.target)
    const view = readContextMenuView({
      editor,
      target,
      screen: input.pointer.point.screen
    })

    if (!view) {
      clear()
      return false
    }

    session = {
      target: result.target,
      restoreSelection: selection,
      view
    }
    menu.set(view)
    return true
  }

  return {
    menu,
    selection: editor.read.context.selection,
    open,
    dismiss,
    clear
  }
}
