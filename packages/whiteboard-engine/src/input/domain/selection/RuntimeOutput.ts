import type { SelectionBoxState } from '@engine-types/state'
import type { SelectionState } from '@engine-types/state'
import type { RoutingDragState } from '@engine-types/edge/routing'
import type { NodeId } from '@whiteboard/core/types'

type Updater<T> = T | ((prev: T) => T)

export type RuntimeOutput = {
  frame?: boolean
  selectionBox?: Updater<SelectionBoxState>
  selection?: Updater<SelectionState>
  groupHover?: NodeId | undefined
  routingDrag?: Updater<RoutingDragState>
  clearRoutingInteraction?: boolean
}
