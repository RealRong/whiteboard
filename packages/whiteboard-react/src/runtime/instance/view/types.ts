import type { Guide } from '@whiteboard/core/node'
import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type {
  ContextMenuResolvedTarget,
  ContextMenuTarget,
  ContextMenuView
} from '../../../ui/chrome/context-menu/types'
import type { ContextMenuOpenResult } from '../../../ui/chrome/context-menu/view'
import type { ScopeView } from '../../view/container'
import type { EdgeView } from './edge'
import type { InteractionView } from '../../view/interaction'
import type { NodeView } from './node'
import type { SelectionState } from '../../view/selection'
import type { NodeToolbarView } from '../../../ui/chrome/toolbar/view'
import type { NodeToolbarMenuKey } from '../../../ui/chrome/toolbar/model'

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
  nodeHandleNodeIds: readonly NodeId[]
  showNodeConnectHandles: boolean
  showEdgeControls: boolean
}

export type SurfaceView = {
  toolbar?: {
    menuKey?: NodeToolbarMenuKey
    value: NodeToolbarView
  }
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
  contextMenuTarget: (target: ContextMenuTarget) => ContextMenuResolvedTarget | undefined
  contextMenuOpenResult: (args: {
    targetElement: Element | null
    screen: Point
    world: Point
  }) => ContextMenuOpenResult | undefined
}
