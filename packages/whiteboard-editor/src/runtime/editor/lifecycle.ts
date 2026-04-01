import type { Editor } from '../../types/editor'
import type { EditorOverlay } from '../overlay'
import type { RuntimeStateController } from '../state'
import type { EngineInstance } from '@whiteboard/engine'

export const createLifecycle = ({
  engine,
  runtime,
  overlay,
  read,
  input,
  featureLifecycle
}: {
  engine: EngineInstance
  runtime: RuntimeStateController
  overlay: Pick<EditorOverlay, 'reset'>
  read: Editor['read']
  input: Editor['input']
  featureLifecycle: {
    reset: () => void
    dispose: () => void
  }
}) => {
  const resetRuntimeState = () => {
    input.cancel()
    overlay.reset()
    runtime.resetLocal()
    featureLifecycle.reset()
  }

  const unsubscribeCommit = engine.commit.subscribe(() => {
    const commit = engine.commit.get()
    if (!commit) {
      return
    }

    if (commit.kind === 'replace') {
      resetRuntimeState()
      return
    }

    runtime.reconcileAfterCommit(read)
  })

  return {
    resetRuntimeState,
    dispose: () => {
      unsubscribeCommit()
      resetRuntimeState()
      featureLifecycle.dispose()
      engine.dispose()
    }
  }
}
