import type { Document } from '@whiteboard/core/types'
import type { Commit, EngineInstance, ReadStore } from '@whiteboard/engine'
import type * as Y from 'yjs'

export type CollabStatus =
  | 'idle'
  | 'connecting'
  | 'bootstrapping'
  | 'connected'
  | 'disconnected'
  | 'error'

export type CollabBootstrapMode =
  | 'auto'
  | 'engine-first'
  | 'yjs-first'

export type CollabProvider = {
  connect?: () => void
  disconnect?: () => void
  destroy?: () => void
  isSynced?: () => boolean
  subscribeSync?: (listener: (synced: boolean) => void) => (() => void)
  awareness?: unknown
}

export type YjsSessionOptions = {
  engine: EngineInstance
  doc: Y.Doc
  provider?: CollabProvider
  bootstrap?: CollabBootstrapMode
}

export type CollabSession = {
  awareness?: unknown
  status: ReadStore<CollabStatus>
  connect: () => void
  disconnect: () => void
  resync: (mode?: CollabBootstrapMode) => void
  destroy: () => void
}

export type RemoteDocumentChange =
  | {
      kind: 'operations'
      operations: readonly import('@whiteboard/core/types').Operation[]
    }
  | {
      kind: 'replace'
      document: Document
    }

export type LocalCommit = Commit & {
  kind: 'apply' | 'undo' | 'redo' | 'replace'
}
