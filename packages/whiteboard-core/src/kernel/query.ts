import type { Document } from '../types'
import { createKernelRuntime } from './internal'
import type { KernelContext, KernelQuery } from './types'

export type { KernelQuery } from './types'

export const createKernelQuery = (
  document: Document,
  context: KernelContext = {}
): KernelQuery => createKernelRuntime(document, context).query
