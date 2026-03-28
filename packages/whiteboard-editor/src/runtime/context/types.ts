import type { ReadStore } from '@whiteboard/engine'
import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type {
  Node,
  NodeId
} from '@whiteboard/core/types'
import type {
  NodeFamily,
  NodeMeta
} from '../../types/node'
import type { ContextTarget } from '../input/target'
import type { PointerPick } from '../pick'
import type { SelectionTarget } from '../selection'

export type ContextOpenSource =
  | 'secondary-press'
  | 'context-menu'

export type ContextOpenInput = {
  source: ContextOpenSource
  pointer: PointerPick
}

export type ContextDismissMode =
  | 'dismiss'
  | 'action'

export type SelectionMenuItemView = {
  key: string
  label: string
  tone?: 'danger'
  disabled?: boolean
  onSelect?: () => unknown
  children?: readonly SelectionMenuItemView[]
}

export type SelectionMenuGroupView = {
  key: string
  title?: string
  items: readonly SelectionMenuItemView[]
}

export type SelectionNodeTypeSummary = {
  key: string
  name: string
  family: NodeFamily
  icon: string
  count: number
}

export type SelectionNodeSummary = {
  ids: readonly NodeId[]
  count: number
  hasGroup: boolean
  lock: 'none' | 'mixed' | 'all'
  types: readonly SelectionNodeTypeSummary[]
  mixed: boolean
}

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
  filter: boolean
  lock: boolean
  copy: boolean
  cut: boolean
  duplicate: boolean
  delete: boolean
}

export type SelectionMenuFilterView = {
  types: readonly SelectionNodeTypeSummary[]
  onSelect: (key: string) => unknown
}

export type SelectionMoreMenuItemView = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onSelect: () => unknown
}

export type SelectionMoreMenuSectionView = {
  key: string
  title: string
  items: readonly SelectionMoreMenuItemView[]
}

export type SelectionLayoutView = {
  canAlign: boolean
  canDistribute: boolean
  onAlign: (mode: NodeAlignMode) => unknown
  onDistribute: (mode: NodeDistributeMode) => unknown
}

export type SelectionMenuView = {
  summary: SelectionNodeSummary
  can: SelectionCan
  filter?: SelectionMenuFilterView
  groups: readonly SelectionMenuGroupView[]
  moreSections: readonly SelectionMoreMenuSectionView[]
  layout: SelectionLayoutView
}

export type ContextMenuItemView = SelectionMenuItemView
export type ContextMenuGroupView = SelectionMenuGroupView
export type ContextNodeTypeSummary = SelectionNodeTypeSummary
export type ContextNodeSummary = SelectionNodeSummary
export type ContextSelectionCan = SelectionCan
export type ContextMenuFilterView = SelectionMenuFilterView

export type ContextMenuView = {
  screen: PointerPick['point']['screen']
  summary?: ContextNodeSummary
  filter?: ContextMenuFilterView
  groups: readonly ContextMenuGroupView[]
}

export type ContextMenuSession = {
  target: ContextTarget
  restoreSelection: SelectionTarget
  view: ContextMenuView
}

export type ContextRuntime = {
  menu: ReadStore<ContextMenuView | null>
  selection: ReadStore<SelectionMenuView | null>
  open: (input: ContextOpenInput) => boolean
  dismiss: (mode: ContextDismissMode) => void
  clear: () => void
}

export type ContextNodeMeta = NodeMeta

export type ContextResolveMeta = (
  node: Node
) => ContextNodeMeta | undefined
