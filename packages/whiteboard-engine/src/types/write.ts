import type {
  ChangeSet,
  Document,
  Operation,
  CoreRegistries
} from '@whiteboard/core/types'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type {
  EngineCommands,
  WriteCommandMap,
  WriteDomain,
  WriteInput,
  WriteOutput
} from './command'
import type { ResolvedHistoryConfig } from './common'
import type { BoardConfig, EngineDocument } from './instance'
import type { CommandFailure, CommandResult } from './result'

export type Apply = <
  D extends WriteDomain,
  C extends WriteCommandMap[D]
>(input: WriteInput<D, C>) => CommandResult<WriteOutput<D, C>>

export type Write = {
  apply: Apply
  replace: EngineCommands['document']['replace']
  history: EngineCommands['history']
}

type SuccessfulWriteBase = {
  ok: true
  data: unknown
  doc: Document
  changes: ChangeSet
}

export type WriteResult<T = void> =
  | CommandFailure
  | (SuccessfulWriteBase & {
      data: T
      kind: 'operations'
      inverse?: readonly Operation[]
      impact: KernelReadImpact
    })
  | (SuccessfulWriteBase & {
      data: T
      kind: 'replace'
    })

export type WriteControl = {
  apply: <
    D extends WriteDomain,
    C extends WriteCommandMap[D]
  >(input: WriteInput<D, C>) => WriteResult<WriteOutput<D, C>>
  replace: (document: Document) => WriteResult
  history: {
    configure: (config: Partial<ResolvedHistoryConfig>) => void
    get: EngineCommands['history']['get']
    clear: EngineCommands['history']['clear']
    undo: () => WriteResult | false
    redo: () => WriteResult | false
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
