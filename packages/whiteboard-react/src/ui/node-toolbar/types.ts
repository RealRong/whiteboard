import type { Node, NodeSchema } from '@whiteboard/core/types'
import type { BoardInstance } from '../../runtime/instance'

type NodeToolbarInstance = Pick<BoardInstance, 'commands' | 'state'>

export type NodeToolbarItemKey =
  | 'fill'
  | 'stroke'
  | 'text'
  | 'group'
  | 'arrange'
  | 'lock'
  | 'more'

export type NodeToolbarMenuKey = Exclude<NodeToolbarItemKey, 'lock'>

export type NodeToolbarActionContext = {
  instance: NodeToolbarInstance
  nodes: readonly Node[]
  primaryNode: Node
  primarySchema?: NodeSchema
  close: () => void
}
