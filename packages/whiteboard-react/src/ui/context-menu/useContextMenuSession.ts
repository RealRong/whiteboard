import { useCallback, useState } from 'react'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { useInternalInstance } from '../../runtime/hooks'
import type { ContextMenuOpenResult } from './model'
import type { ContextMenuSession, ContextMenuSelectionSnapshot } from './types'

const snapshotSelection = (
  nodeIds: readonly NodeId[],
  edgeId?: EdgeId
): ContextMenuSelectionSnapshot => ({
  nodeIds,
  edgeId
})

const restoreSelection = (
  instance: ReturnType<typeof useInternalInstance>,
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
  const instance = useInternalInstance()
  const [session, setSession] = useState<ContextMenuSession>(null)

  const open = useCallback((result: ContextMenuOpenResult) => {
    if (result.leaveScope) {
      instance.commands.selection.clear()
      instance.commands.container.exit()
    }

    const selection = instance.view.selection.get()
    setSession({
      screen: result.payload.screen,
      target: result.payload.target,
      selection: snapshotSelection(selection.nodeIds, selection.edgeId)
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
