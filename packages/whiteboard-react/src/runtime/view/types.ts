import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { ScopeView } from './container'
import type { EdgeView } from './edge'
import type { InteractionView } from './interaction'
import type { NodeView } from './node'
import type { SelectionState } from './selection'
import type { EditorTool } from '../instance/toolState'

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

export type WhiteboardView = {
  tool: ValueView<EditorTool>
  selection: ValueView<SelectionState>
  scope: ValueView<ScopeView>
  interaction: ValueView<InteractionView>
  node: KeyedView<NodeId | undefined, NodeView | undefined, { selected?: boolean }>
  edge: KeyedView<EdgeId | undefined, EdgeView | undefined>
}
