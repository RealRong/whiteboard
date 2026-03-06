import type { Document, Operation } from '../types'
import { getReusableKernelRuntime } from './internal'
import { invertOperations } from './invert'
import { normalizeOperations } from './normalize'
import type { KernelContext, KernelReduceResult } from './types'

export const reduceOperations = (
  document: Document,
  operations: readonly Operation[],
  context: KernelContext = {}
): KernelReduceResult => {
  const normalizedOperations = normalizeOperations(document, operations)
  const runtime = getReusableKernelRuntime(document, context)
  const applied = runtime.applyOperations(normalizedOperations, context.origin ?? 'user')
  if (!applied.ok) return applied

  const inverse = invertOperations(applied.changes.operations)
  if (!inverse.ok) return inverse

  return {
    ok: true,
    doc: runtime.query.document(),
    changes: applied.changes,
    inverse: inverse.operations
  }
}
