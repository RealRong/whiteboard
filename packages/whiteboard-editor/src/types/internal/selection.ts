import type { SelectionMode } from '@whiteboard/core/node'
export type {
  SelectionInput,
  SelectionSummary,
  SelectionTarget,
  SelectionTransform
} from '@whiteboard/core/selection'
import type {
  SelectionInput,
  SelectionSummary,
  SelectionTarget,
  SelectionTransform
} from '@whiteboard/core/selection'
import type {
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { ValueStore } from '@whiteboard/engine'
import type { EditField } from '../../runtime/edit'
import type { PointerDown } from '../../runtime/input/pointer'

export type SelectionCommands = {
  replace: (input: SelectionInput) => void
  add: (input: SelectionInput) => void
  remove: (input: SelectionInput) => void
  toggle: (input: SelectionInput) => void
  clear: () => void
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
  start: PointerDown
  selection: SelectionSummary
}
