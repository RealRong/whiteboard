import type { ReadStore } from '@whiteboard/engine'
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

export type ContextMenuItemView = {
  key: string
  label: string
  tone?: 'danger'
  disabled?: boolean
  onSelect?: () => unknown
  children?: readonly ContextMenuItemView[]
}

export type ContextMenuGroupView = {
  key: string
  title?: string
  items: readonly ContextMenuItemView[]
}

export type ContextNodeTypeSummary = {
  key: string
  name: string
  family: NodeFamily
  icon: string
  count: number
}

export type ContextNodeSummary = {
  ids: readonly NodeId[]
  count: number
  hasGroup: boolean
  lock: 'none' | 'mixed' | 'all'
  types: readonly ContextNodeTypeSummary[]
  mixed: boolean
}

export type ContextSelectionCan = {
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

export type ContextMenuFilterView = {
  types: readonly ContextNodeTypeSummary[]
  onSelect: (key: string) => unknown
}

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
  open: (input: ContextOpenInput) => boolean
  dismiss: (mode: ContextDismissMode) => void
  clear: () => void
}

export type ContextNodeMeta = NodeMeta

export type ContextResolveMeta = (
  node: Node
) => ContextNodeMeta | undefined
