import type { Operation } from '../types'
import { createKernelFailure } from './internal'
import type { KernelInvertResult } from './types'
import { buildInverseOperations } from './inversion'

export const invertOperations = (operations: Operation[]): KernelInvertResult => {
  const result = buildInverseOperations(operations)
  if (!result.ok) {
    return createKernelFailure('invalid', 'Operation is not invertible.')
  }
  return { ok: true, operations: result.operations }
}
