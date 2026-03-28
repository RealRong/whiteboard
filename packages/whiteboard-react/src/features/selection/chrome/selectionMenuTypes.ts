import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { NodeTypeSummary } from '../../node/summary'

export type SelectionMenuItem = {
  key: string
  label: string
  tone?: 'danger'
  disabled?: boolean
  onClick?: () => unknown
  children?: readonly SelectionMenuItem[]
}

export type SelectionMenuGroup = {
  key: string
  title?: string
  items: readonly SelectionMenuItem[]
}

export type SelectionMenuFilter = {
  types: readonly NodeTypeSummary[]
  onSelect: (key: string) => unknown
}

export type SelectionMoreMenuItem = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onClick: () => unknown
}

export type SelectionMoreMenuSection = {
  key: string
  title: string
  items: readonly SelectionMoreMenuItem[]
}

export type SelectionLayoutActions = {
  canAlign: boolean
  canDistribute: boolean
  onAlign: (mode: NodeAlignMode) => unknown
  onDistribute: (mode: NodeDistributeMode) => unknown
}
