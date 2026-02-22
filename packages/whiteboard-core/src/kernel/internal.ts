import type { Core, CoreRegistries, DispatchFailure, Document } from '../types'
import { createCore } from '../core/createCore'
import type { KernelContext, KernelRegistriesSnapshot } from './types'

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (clone) {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export const cloneDocument = (document: Document): Document => cloneValue(document)

export const applyKernelRegistries = (
  registries: CoreRegistries,
  snapshot?: KernelRegistriesSnapshot
) => {
  if (!snapshot) return

  snapshot.nodeTypes?.forEach((definition) => {
    registries.nodeTypes.register(definition)
  })
  snapshot.edgeTypes?.forEach((definition) => {
    registries.edgeTypes.register(definition)
  })
  snapshot.nodeSchemas?.forEach((schema) => {
    registries.schemas.registerNode(schema)
  })
  snapshot.edgeSchemas?.forEach((schema) => {
    registries.schemas.registerEdge(schema)
  })
  snapshot.serializers?.forEach((serializer) => {
    registries.serializers.register(serializer)
  })
}

export const createKernelCore = (
  document: Document,
  context: KernelContext = {}
): Core => {
  const core = createCore({
    document: cloneDocument(document),
    now: context.now
  })
  applyKernelRegistries(core.registries, context.registries)
  return core
}

export const createKernelFailure = (
  reason: DispatchFailure['reason'],
  message?: string
): DispatchFailure => ({
  ok: false,
  reason,
  message
})
