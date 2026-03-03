import type { Deps as ReadDeps } from '@engine-types/read/deps'
import type { Query } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'
import type { Change } from '@engine-types/write/change'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import { createReadKernel } from './kernel'

type ReadRuntimePort = {
  query: Query
  read: EngineRead
  applyChange: (change: Change) => void
  applyInvalidation: (invalidation: ReadInvalidation) => void
}

export const orchestrator = (deps: ReadDeps): ReadRuntimePort =>
  createReadKernel(deps)
