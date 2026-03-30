import type { Editor } from '../../types/editor'
import { finalize } from './finalize'
import type { EditorKernel } from '../../types/internal/editor'

export const createLifecycle = ({
  kernel,
  read,
  input,
  featureLifecycle
}: {
  kernel: EditorKernel
  read: Editor['read']
  input: Editor['input']
  featureLifecycle: {
    reset: () => void
    dispose: () => void
  }
}) => {
  const syncHistory = () => {
    kernel.history.set(kernel.engine.commands.history.get())
  }

  const resetUiProjectionState = () => {
    input.cancel()
    kernel.edit.commands.clear()
    kernel.selection.commands.clear()
    kernel.frame.commands.clear()
    featureLifecycle.reset()
  }

  const unsubscribeCommit = kernel.engine.commit.subscribe(() => {
    syncHistory()
    const commit = kernel.engine.commit.get()
    if (!commit) {
      return
    }

    if (commit.kind === 'replace') {
      resetUiProjectionState()
      return
    }

    finalize({
      read,
      frame: kernel.frame,
      selection: kernel.selection,
      edit: kernel.edit
    })
  })

  return {
    syncHistory,
    resetUiProjectionState,
    dispose: () => {
      unsubscribeCommit()
      resetUiProjectionState()
      featureLifecycle.dispose()
      kernel.engine.dispose()
    }
  }
}
