import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from './types'
import type { InteractionCoordinator, SnapRuntime } from '../interaction'
import type { ContextRuntime } from '../context'
import { finalize } from '../finalize'
import type { EditorInternals, EditorStores } from './createEditorStores'

export const createEditorLifecycle = ({
  engine,
  read,
  stores,
  input,
  interaction,
  context,
  snap,
  internals
}: {
  engine: EngineInstance
  read: Editor['read']
  stores: EditorStores
  input: Editor['input']
  interaction: InteractionCoordinator
  context: ContextRuntime
  snap: SnapRuntime
  internals: EditorInternals
}) => {
  const syncHistory = () => {
    stores.history.set(engine.commands.history.get())
  }

  const resetUiSessionState = () => {
    input.cancel()
    interaction.cancel()
    context.clear()
    stores.edit.commands.clear()
    stores.selection.commands.clear()
    stores.frame.commands.clear()
    snap.node.clear()
    internals.node.clear()
    internals.edge.preview.clear()
    internals.mindmapDrag.clear()
  }

  const unsubscribeCommit = engine.commit.subscribe(() => {
    syncHistory()
    const commit = engine.commit.get()
    if (!commit) {
      return
    }

    if (commit.kind === 'replace') {
      resetUiSessionState()
      return
    }

    finalize({
      read,
      frame: stores.frame,
      selection: stores.selection,
      edit: stores.edit
    })
  })

  return {
    syncHistory,
    resetUiSessionState,
    dispose: () => {
      unsubscribeCommit()
      resetUiSessionState()
      engine.dispose()
    }
  }
}
