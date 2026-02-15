import type { Core, CoreHistoryState, DocumentId } from '@whiteboard/core'
import type { WhiteboardStateSnapshot } from '@engine-types/instance'

export type HistoryIdentity = {
  core: Core
  docId: DocumentId
}

export const toHistoryState = (snapshot: CoreHistoryState): WhiteboardStateSnapshot['history'] => ({
  canUndo: snapshot.canUndo,
  canRedo: snapshot.canRedo,
  undoDepth: snapshot.undoDepth,
  redoDepth: snapshot.redoDepth,
  isApplying: snapshot.isApplying,
  lastUpdatedAt: snapshot.lastUpdatedAt
})

export const shouldClearHistory = (
  previous: HistoryIdentity | null,
  next: HistoryIdentity
) => {
  if (!previous) return false
  if (previous.core !== next.core) return true
  return previous.docId !== next.docId
}
