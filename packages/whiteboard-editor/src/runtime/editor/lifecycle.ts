import type { Editor } from '../../types/public/editor'
import { finalize } from './finalize'
import type { EditorKernel } from '../../types/internal/editor'
import type { EditorFeatureCapsule } from '../../types/runtime/editor/capsule'

export const createLifecycle = ({
  kernel,
  read,
  input,
  capsules
}: {
  kernel: EditorKernel
  read: Editor['read']
  input: Editor['input']
  capsules: readonly EditorFeatureCapsule[]
}) => {
  const syncHistory = () => {
    kernel.document.history.set(kernel.document.engine.commands.history.get())
  }

  const resetUiProjectionState = () => {
    input.cancel()
    kernel.state.edit.commands.clear()
    kernel.state.selection.commands.clear()
    kernel.state.frame.commands.clear()
    capsules.forEach((capsule) => {
      capsule.lifecycle?.reset?.()
    })
  }

  const unsubscribeCommit = kernel.document.engine.commit.subscribe(() => {
    syncHistory()
    const commit = kernel.document.engine.commit.get()
    if (!commit) {
      return
    }

    if (commit.kind === 'replace') {
      resetUiProjectionState()
      return
    }

    finalize({
      read,
      frame: kernel.state.frame,
      selection: kernel.state.selection,
      edit: kernel.state.edit
    })
  })

  return {
    syncHistory,
    resetUiProjectionState,
    dispose: () => {
      unsubscribeCommit()
      resetUiProjectionState()
      capsules.forEach((capsule) => {
        capsule.lifecycle?.dispose?.()
      })
      kernel.document.engine.dispose()
    }
  }
}
