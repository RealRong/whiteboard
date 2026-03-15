import type { Node, NodeSchema } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../runtime/instance'

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
  instance: InternalWhiteboardInstance
  nodes: readonly Node[]
  primaryNode: Node
  primarySchema?: NodeSchema
  close: () => void
}

export type NodeToolbarItem = {
  key: NodeToolbarItemKey
  label: string
  active: boolean
}
