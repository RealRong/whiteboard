import type {
  EdgeId,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance'

type ContextMenuInstance = Pick<WhiteboardInstance, 'commands' | 'read' | 'state'>

export type ContextMenuItemTone = 'default' | 'danger'

export type ContextMenuActionContext = {
  instance: ContextMenuInstance
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

export type ContextMenuSelectionSnapshot = {
  nodeIds: readonly NodeId[]
  edgeId?: EdgeId
}

export type ContextMenuSession = {
  screen: Point
  target: ContextMenuTarget
  selection: ContextMenuSelectionSnapshot
} | null

export type ContextMenuModel = {
  placement: {
    left: number
    top: number
    transform?: string
  }
  sections: readonly ContextMenuSection[]
}
