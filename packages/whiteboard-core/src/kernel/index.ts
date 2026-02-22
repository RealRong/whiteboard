export { buildIntent } from './build'
export { createRegistries } from './registries'
export { reduceOperations } from './reduce'
export { invertOperations } from './invert'
export { createKernelQuery } from './query'

export type {
  KernelBuildResult,
  KernelContext,
  KernelInvertResult,
  KernelReduceResult,
  KernelRegistriesSnapshot
} from './types'
