import type { Deps as ReadDeps } from '@engine-types/read/deps'
import type { Query } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'
import type { Change } from '@engine-types/write/change'
import { createReadKernel } from './kernel'

type ReadRuntimePort = {
  query: Query
  read: EngineRead
  applyChange: (change: Change) => void
}

export const orchestrator = (deps: ReadDeps): ReadRuntimePort =>
  createReadKernel(deps)
