import type { RoutingDragState } from '@engine-types/edge/routing'
import type { Operation } from '@whiteboard/core/types'
import type { SelectionState } from '@engine-types/state'

type Updater<T> = T | ((prev: T) => T)

export type InteractionPatch = {
  kind: 'routingDrag'
  pointerId: number | null
}

export type RuntimeOutput = {
  frame?: boolean
  interaction?: InteractionPatch
  clearInteractions?: readonly InteractionPatch['kind'][]
  routingDrag?: Updater<RoutingDragState>
  selection?: Updater<SelectionState>
  mutations?: Operation[]
}
