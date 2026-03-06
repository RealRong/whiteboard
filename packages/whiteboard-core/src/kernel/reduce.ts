import type { Document, Operation } from '../types'
import {
  cloneDocument,
  createKernelSession
} from './session'
import type { KernelContext, KernelReduceResult } from './types'

export const reduceOperations = (
  document: Document,
  operations: readonly Operation[],
  context: KernelContext = {}
): KernelReduceResult => {
  const session = createKernelSession({
    document: cloneDocument(document),
    now: context.now
  })
  const applied = session.applyOperations(operations, context.origin ?? 'user')
  if (!applied.ok) return applied

  return {
    ok: true,
    doc: session.exportDocument(),
    changes: applied.changes,
    inverse: applied.inverse,
    invalidation: applied.invalidation
  }
}
