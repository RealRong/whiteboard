import type { Editor } from '../../types/editor'
import { finalize } from './finalize'
import type { EditorKernel } from './types'

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
  const resetRuntimeState = () => {
    input.cancel()
    kernel.edit.mutate.clear()
    kernel.selection.mutate.clear()
    featureLifecycle.reset()
  }

  const unsubscribeCommit = kernel.engine.commit.subscribe(() => {
    const commit = kernel.engine.commit.get()
    if (!commit) {
      return
    }

    if (commit.kind === 'replace') {
      resetRuntimeState()
      return
    }

    finalize({
      read,
      selection: kernel.selection,
      edit: kernel.edit
    })
  })

  return {
    resetRuntimeState,
    dispose: () => {
      unsubscribeCommit()
      resetRuntimeState()
      featureLifecycle.dispose()
      kernel.engine.dispose()
    }
  }
}
