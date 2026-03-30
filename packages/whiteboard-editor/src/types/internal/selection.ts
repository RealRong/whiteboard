export type {
  SelectionInput,
  SelectionSummary,
  SelectionTarget,
  SelectionTransform
} from '@whiteboard/core/selection'
import type {
  SelectionInput,
  SelectionTarget
} from '@whiteboard/core/selection'
import type { ValueStore } from '@whiteboard/engine'

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
