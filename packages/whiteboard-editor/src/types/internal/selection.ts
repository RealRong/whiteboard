import type { SelectionMode } from '@whiteboard/core/node'
import type {
  Edge,
  EdgeId,
  Node,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { ValueStore } from '@whiteboard/engine'
import type { EditField } from '../../runtime/edit'
import type { PointerStart } from '../../runtime/input/pointer'

export type SelectionInput = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
}

export type SelectionTarget = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type SelectionCommands = {
  replace: (input: SelectionInput) => void
  add: (input: SelectionInput) => void
  remove: (input: SelectionInput) => void
  toggle: (input: SelectionInput) => void
  clear: () => void
}

export type SelectionTransform = {
  move: boolean
  resize: 'none' | 'resize' | 'scale'
}

export type SelectionSnapshot = {
  kind: 'none' | 'node' | 'nodes' | 'edge' | 'edges' | 'mixed'
  target: {
    nodeIds: readonly NodeId[]
    nodeSet: ReadonlySet<NodeId>
    edgeIds: readonly EdgeId[]
    edgeSet: ReadonlySet<EdgeId>
    edgeId?: EdgeId
  }
  items: {
    nodes: readonly Node[]
    edges: readonly Edge[]
    primaryNode?: Node
    primaryEdge?: Edge
    count: number
    nodeCount: number
    edgeCount: number
  }
  transform: SelectionTransform
  box?: Rect
  boxInteractive: boolean
}

export type SelectionStore = {
  source: ValueStore<SelectionTarget>
  commands: SelectionCommands
}

export type SelectionTapAction =
  | { kind: 'clear' }
  | {
      kind: 'select'
      target: SelectionTarget
      verifyNodeIds?: readonly NodeId[]
    }
  | {
      kind: 'edit'
      nodeId: NodeId
      field: EditField
      verifyNodeIds: readonly NodeId[]
    }

export type SelectionDragAction =
  | {
      kind: 'move'
      frame: Rect
      anchorId: NodeId
      target: SelectionTarget
      nextSelection?: SelectionTarget
    }
  | {
      kind: 'marquee'
      match: 'touch' | 'contain'
      mode: SelectionMode
      base: SelectionTarget
    }

export type SelectionPressPlan = {
  chrome: boolean
  tap?: SelectionTapAction
  drag?: SelectionDragAction
  allowHold: boolean
}

export type SelectionPolicyInput = {
  start: PointerStart
  snapshot: SelectionSnapshot
}
