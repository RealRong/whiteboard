import type {
  ChangeSet,
  DispatchFailure,
  DispatchResult,
  Document,
  Operation,
  CoreRegistries
} from '@whiteboard/core/types'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { EngineCommands, WriteDomain, WriteInput } from './command'
import type { ResolvedHistoryConfig } from './common'
import type { BoardConfig, EngineDocument } from './instance'

export type Apply = <D extends WriteDomain>(input: WriteInput<D>) => Promise<DispatchResult>

export type Write = {
  apply: Apply
  replace: EngineCommands['document']['replace']
  history: EngineCommands['history']
}

type SuccessfulWriteBase = {
  ok: true
  doc: Document
  changes: ChangeSet
}

export type WriteCommit =
  | DispatchFailure
  | (SuccessfulWriteBase & {
      kind: 'operations'
      inverse?: readonly Operation[]
      impact: KernelReadImpact
    })
  | (SuccessfulWriteBase & {
      kind: 'replace'
    })

export type WriteControl = {
  apply: <D extends WriteDomain>(input: WriteInput<D>) => Promise<WriteCommit>
  replace: (doc: Document) => Promise<WriteCommit>
  history: {
    configure: (config: Partial<ResolvedHistoryConfig>) => void
    get: EngineCommands['history']['get']
    clear: EngineCommands['history']['clear']
    undo: () => WriteCommit | false
    redo: () => WriteCommit | false
  }
}

export type WriteInstance = {
  document: EngineDocument
  config: BoardConfig
  registries: CoreRegistries
}

export type WriteDeps = {
  instance: WriteInstance
}
