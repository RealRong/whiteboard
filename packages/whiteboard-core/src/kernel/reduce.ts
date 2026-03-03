import type { Document, Operation } from '../types'
import { getReusableKernelCore } from './internal'
import { invertOperations } from './invert'
import { normalizeOperations } from './normalize'
import type { KernelContext, KernelReduceResult } from './types'

export const reduceOperations = (
  document: Document,
  operations: Operation[],
  context: KernelContext = {}
): KernelReduceResult => {
  const normalizedOperations = normalizeOperations(document, operations)
  const core = getReusableKernelCore(document, context)
  const applied = core.apply.operations(normalizedOperations, {
    origin: context.origin ?? 'user'
  })
  if (!applied.ok) return applied

  const inverse = invertOperations(applied.changes.operations)
  if (!inverse.ok) return inverse

  return {
    ok: true,
    doc: core.query.document(),
    changes: applied.changes,
    inverse: inverse.operations
  }
}
