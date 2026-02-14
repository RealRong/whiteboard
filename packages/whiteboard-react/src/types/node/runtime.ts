import type { SnapRuntimeData } from '@whiteboard/engine'
import type { Guide } from './snap'

export type SnapRuntime = SnapRuntimeData & {
  onGuidesChange: (guides: Guide[]) => void
}
