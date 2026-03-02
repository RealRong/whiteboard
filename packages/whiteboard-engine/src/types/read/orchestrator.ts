import type { Query } from '../instance/query'
import type { EngineRead } from '../instance/read'
import type { Change } from '../write/change'

export type Orchestrator = {
  query: Query
  read: EngineRead
  applyChange: (change: Change) => void
}
