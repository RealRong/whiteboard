import type { MindmapDragState } from '@engine-types/state'

type Updater<T> = T | ((prev: T) => T)

export type RuntimeOutput = {
  frame?: boolean
  interaction?: {
    pointerId: number | null
  }
  mindmapDrag?: Updater<MindmapDragState>
}
