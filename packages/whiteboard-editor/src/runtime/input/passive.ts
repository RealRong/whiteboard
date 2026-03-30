import type {
  PointerMove,
  ResolvedWheelInput
} from './pointer'
import type { Tool } from '../tool'
import type { InteractionMode } from '../../types/runtime/interaction'

export type PassiveInputContext = {
  mode: InteractionMode
  tool: Tool
}

export type PassiveInputProcessor = {
  kind: string
  priority?: number
  when?: (context: PassiveInputContext) => boolean
  move?: (input: PointerMove) => void
  leave?: () => void
  blur?: () => void
  cancel?: () => void
  wheel?: (input: ResolvedWheelInput) => boolean
}

const byPriorityDesc = (
  left: PassiveInputProcessor,
  right: PassiveInputProcessor
) => (right.priority ?? 0) - (left.priority ?? 0)

const canRun = (
  processor: PassiveInputProcessor,
  context: PassiveInputContext
) => processor.when?.(context) ?? true

export type PassiveInputRuntime = {
  move: (
    input: PointerMove,
    context: PassiveInputContext
  ) => void
  leave: (context: PassiveInputContext) => void
  blur: (context: PassiveInputContext) => void
  cancel: () => void
  wheel: (
    input: ResolvedWheelInput,
    context: PassiveInputContext
  ) => boolean
}

export const createPassiveInputRuntime = (
  processors: readonly PassiveInputProcessor[]
): PassiveInputRuntime => {
  const ordered = [...processors].sort(byPriorityDesc)

  return {
    move: (input, context) => {
      ordered.forEach((processor) => {
        if (!canRun(processor, context)) {
          return
        }
        processor.move?.(input)
      })
    },
    leave: (context) => {
      ordered.forEach((processor) => {
        if (!canRun(processor, context)) {
          return
        }
        processor.leave?.()
      })
    },
    blur: (context) => {
      ordered.forEach((processor) => {
        if (!canRun(processor, context)) {
          return
        }
        processor.blur?.()
      })
    },
    cancel: () => {
      ordered.forEach((processor) => {
        processor.cancel?.()
      })
    },
    wheel: (input, context) => {
      let handled = false

      ordered.forEach((processor) => {
        if (!canRun(processor, context)) {
          return
        }
        handled = processor.wheel?.(input) || handled
      })

      return handled
    }
  }
}
