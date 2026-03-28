import type { ValueStore } from '@whiteboard/engine'
import type { InternalEditor } from '../instance/types'
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

type ContextRuntimeHost = Pick<InternalEditor, 'commands' | 'host' | 'read' | 'state'>

const writeSelection = (
  instance: Pick<InternalEditor, 'commands'>,
  target: ContextMenuSession['restoreSelection']
) => {
  if (target.nodeIds.length > 0 || target.edgeIds.length > 0) {
    instance.commands.selection.replace({
      nodeIds: target.nodeIds,
      edgeIds: target.edgeIds
    })
    return
  }

  instance.commands.selection.clear()
}

export const createContextRuntime = (
  instance: ContextRuntimeHost,
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
      writeSelection(instance, current.restoreSelection)
    }
  }

  const open = (
    input: ContextOpenInput
  ) => {
    const result = readContextOpen(instance, input.pointer)
    if (!result) {
      clear()
      return false
    }

    const selection = instance.read.selection.get().target

    if (result.leaveFrame) {
      instance.commands.frame.exit()
    }

    const target = resolveContextTarget(instance, result.target)
    const view = readContextMenuView({
      instance,
      target,
      screen: input.pointer.point.screen,
      close: () => dismiss('action')
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
    open,
    dismiss,
    clear
  }
}
