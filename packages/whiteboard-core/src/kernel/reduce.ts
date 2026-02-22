import type { Document, Operation } from '../types'
import { createKernelCore } from './internal'
import { invertOperations } from './invert'
import type { KernelContext, KernelReduceResult } from './types'

export const reduceOperations = (
  document: Document,
  operations: Operation[],
  context: KernelContext = {}
): KernelReduceResult => {
  const core = createKernelCore(document, context)
  const applied = core.apply.operations(operations, {
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

