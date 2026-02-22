import type { Core, Document } from '../types'
import { createKernelCore } from './internal'
import type { KernelContext } from './types'

export type KernelQuery = Core['query']

export const createKernelQuery = (
  document: Document,
  context: KernelContext = {}
): KernelQuery => createKernelCore(document, context).query

