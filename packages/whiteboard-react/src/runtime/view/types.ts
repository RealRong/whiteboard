import type { Guide } from '@whiteboard/core/node'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import type {
  ContextMenuView
} from '../../ui/chrome/context-menu/types'
import type { ScopeView } from './container'
import type { EdgeView } from './edge'
import type { InteractionView } from './interaction'
import type { NodeView } from './node'
import type { SelectionState } from './selection'
import type { NodeToolbarView } from '../../ui/chrome/toolbar/view'
import type { NodeToolbarMenuKey } from '../../ui/chrome/toolbar/model'

export type ValueView<T> = {
  get: () => T
  subscribe: (listener: () => void) => () => void
  isEqual?: (left: T, right: T) => boolean
}

export type KeyedView<Key, T, Args = undefined> = {
  get: (key: Key, args?: Args) => T
  subscribe: (key: Key, listener: () => void) => () => void
  isEqual?: (left: T, right: T) => boolean
}

export type ParameterizedView<Args, T> = {
  get: (args: Args) => T
  subscribe: (listener: () => void) => () => void
  isEqual?: (left: T, right: T) => boolean
}

export type OverlayView = {
  selectionBox?: Rect
  guides: readonly Guide[]
  activeScope?: {
    nodeId: NodeId
    title: string
    rect: Rect
  }
}

export type SurfaceToolbarView =
  NodeToolbarView & {
    activeMenuKey?: NodeToolbarMenuKey
  }

export type SurfaceView = {
  toolbar?: SurfaceToolbarView
  contextMenu?: ContextMenuView
}

export type WhiteboardView = {
  selection: ValueView<SelectionState>
  scope: ValueView<ScopeView>
  interaction: ValueView<InteractionView>
  overlay: ValueView<OverlayView>
  surface: ParameterizedView<{
    containerWidth: number
    containerHeight: number
  }, SurfaceView>
  node: KeyedView<NodeId | undefined, NodeView | undefined, { selected?: boolean }>
  edge: KeyedView<EdgeId | undefined, EdgeView | undefined>
}
