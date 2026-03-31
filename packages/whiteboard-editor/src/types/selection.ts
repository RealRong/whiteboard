import type { SelectionSummary } from '@whiteboard/core/selection'
import type { NodeId } from '@whiteboard/core/types'

export type SelectionCan = {
  fill: boolean
  stroke: boolean
  text: boolean
  group: boolean
  align: boolean
  distribute: boolean
  makeGroup: boolean
  ungroup: boolean
  order: boolean
  filterByType: boolean
  lock: boolean
  copy: boolean
  cut: boolean
  duplicate: boolean
  delete: boolean
}

export type SelectionTypeStat = {
  type: string
  count: number
  nodeIds: readonly NodeId[]
}

export type SelectionStyleSnapshot = {
  stroke: string
  strokeWidth: number
  strokeWidthPreset: 'default' | 'draw'
  opacity?: number
}

export type SelectionSnapshot = {
  summary: SelectionSummary
  can: SelectionCan
  types: readonly SelectionTypeStat[]
  style: SelectionStyleSnapshot | null
}
