import type { PointerInput } from '@engine-types/common'
import type { PointerIntent } from '../../input/pointer/intents'

export type InteractionBindingSpec = {
  watch: (listener: () => void) => () => void
  getActive: () => unknown
  getPointerId: (active: unknown) => number | undefined | null
  toMoveIntent?: (pointer: PointerInput) => PointerIntent
  toUpIntent?: (pointer: PointerInput) => PointerIntent
  toCancelIntent?: (pointer: PointerInput) => PointerIntent
}

export const readPointerId = (active: unknown) =>
  (active as { pointerId?: number | null }).pointerId

export const readTransformPointerId = (active: unknown) =>
  (active as { drag?: { pointerId?: number | null } }).drag?.pointerId
