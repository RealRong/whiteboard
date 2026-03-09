import type {
  ChangeSet,
  DispatchFailure,
  DispatchResult,
  Document,
  Operation,
  CoreRegistries
} from '@whiteboard/core/types'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { Commands, WriteDomain, WriteInput } from './command'
import type { ResolvedHistoryConfig } from './common'
import type { EngineDocument, InstanceConfig } from './instance'
import type { Scheduler } from '../scheduling/Scheduler'

export type NodeCommandsApi = Commands['node']

export type EdgeCommandsApi = Commands['edge']

export type MindmapCommandsApi = Commands['mindmap']

export type ViewportCommandsApi = Commands['viewport']

export type Apply = <D extends WriteDomain>(input: WriteInput<D>) => Promise<DispatchResult>

export type Write = {
  apply: Apply
  load: Commands['doc']['load']
  replace: Commands['doc']['replace']
  history: Commands['history']
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
  load: (doc: Document) => Promise<WriteCommit>
  replace: (doc: Document) => Promise<WriteCommit>
  history: {
    configure: (config: Partial<ResolvedHistoryConfig>) => void
    get: Commands['history']['get']
    clear: Commands['history']['clear']
    undo: () => WriteCommit | false
    redo: () => WriteCommit | false
  }
}

export type WriteInstance = {
  document: EngineDocument
  config: InstanceConfig
  registries: CoreRegistries
}

export type WriteDeps = {
  instance: WriteInstance
  scheduler: Scheduler
}
