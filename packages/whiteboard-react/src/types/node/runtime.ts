import type { NodeId } from '@whiteboard/core'
import type { Guide } from './snap'
import type { GroupRuntime, SnapRuntimeData } from '../state'

export type GroupRuntimeStore = GroupRuntime & {
  setHoveredGroupId: (groupId?: NodeId) => void
}

export type SnapRuntime = SnapRuntimeData & {
  onGuidesChange: (guides: Guide[]) => void
}
