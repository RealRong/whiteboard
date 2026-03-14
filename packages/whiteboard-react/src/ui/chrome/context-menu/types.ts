import type {
  EdgeId,
  Node,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../../runtime/instance'

export type ContextMenuItemTone = 'default' | 'danger'

export type ContextMenuActionContext = {
  instance: InternalWhiteboardInstance
  close: () => void
}

export type ContextMenuItem = {
  key: string
  label: string
  tone?: ContextMenuItemTone
  disabled?: boolean
  run: (context: ContextMenuActionContext) => void
}

export type ContextMenuSection = {
  key: string
  title?: string
  items: readonly ContextMenuItem[]
}

export type ContextMenuTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; nodeId: NodeId; world: Point }
  | { kind: 'nodes'; nodeIds: readonly NodeId[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

export type ContextMenuOpenPayload = {
  screen: Point
  target: ContextMenuTarget
}

export type ContextMenuResolvedTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; node: Node; world: Point }
  | { kind: 'nodes'; nodes: readonly Node[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

export type ContextMenuView = {
  placement: {
    left: number
    top: number
    transform?: string
  }
  sections: readonly ContextMenuSection[]
}
