import type {
  ChangeSet,
  DispatchFailure,
  Document,
  EdgeSchema,
  EdgeTypeDefinition,
  NodeSchema,
  NodeTypeDefinition,
  Operation,
  Origin,
  Serializer
} from '../types'

export type KernelRegistriesSnapshot = {
  nodeTypes?: NodeTypeDefinition[]
  edgeTypes?: EdgeTypeDefinition[]
  nodeSchemas?: NodeSchema[]
  edgeSchemas?: EdgeSchema[]
  serializers?: Serializer[]
}

export type KernelContext = {
  now?: () => number
  origin?: Origin
  registries?: KernelRegistriesSnapshot
}

export type KernelInvertResult =
  | { ok: true; operations: Operation[] }
  | DispatchFailure

export type KernelReduceResult =
  | {
      ok: true
      doc: Document
      changes: ChangeSet
      inverse: Operation[]
    }
  | DispatchFailure
