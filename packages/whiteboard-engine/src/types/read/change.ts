import type {
  KernelProjectionInvalidation,
  KernelRebuild
} from '@whiteboard/core/kernel'

export type Rebuild = KernelRebuild
export type IndexChange = KernelProjectionInvalidation['index']
export type EdgeChange = KernelProjectionInvalidation['edge']
