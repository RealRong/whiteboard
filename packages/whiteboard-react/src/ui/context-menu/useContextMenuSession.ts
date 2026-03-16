import { useCallback, useState } from 'react'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { BoardInstance } from '../../runtime/instance'
import { useInstance } from '../../runtime/hooks'
import type { ContextMenuOpenResult } from './read'
import type { ContextMenuSession, ContextMenuSelectionSnapshot } from './types'

const snapshotSelection = (
  nodeIds: readonly NodeId[],
  edgeId?: EdgeId
): ContextMenuSelectionSnapshot => ({
  nodeIds,
  edgeId
})

const restoreSelection = (
  instance: Pick<BoardInstance, 'commands'>,
  selection: ContextMenuSelectionSnapshot
) => {
  if (selection.edgeId !== undefined) {
    instance.commands.selection.selectEdge(selection.edgeId)
    return
  }

  if (selection.nodeIds.length > 0) {
    instance.commands.selection.select(selection.nodeIds, 'replace')
    return
  }

  instance.commands.selection.clear()
}

export const useContextMenuSession = () => {
  const instance = useInstance()
  const [session, setSession] = useState<ContextMenuSession>(null)

  const open = useCallback((result: ContextMenuOpenResult) => {
    if (result.leaveContainer) {
      instance.commands.selection.clear()
      instance.commands.container.exit()
    }

    const selection = instance.state.selection.get()
    setSession({
      screen: result.payload.screen,
      target: result.payload.target,
      selection: snapshotSelection(
        selection.target.nodeIds,
        selection.target.edgeId
      )
    })
  }, [instance])

  const close = useCallback((mode: 'dismiss' | 'action') => {
    if (mode === 'dismiss' && session) {
      restoreSelection(instance, session.selection)
    }
    setSession(null)
  }, [instance, session])

  return {
    session,
    open,
    close
  }
}
