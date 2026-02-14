import type { Guide } from './snap'
import type { SnapRuntimeData } from '../state'

export type SnapRuntime = SnapRuntimeData & {
  onGuidesChange: (guides: Guide[]) => void
}
