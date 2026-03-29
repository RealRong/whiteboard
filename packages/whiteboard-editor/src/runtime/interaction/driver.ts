import type { PointerDown } from '../input/pointer'

export type InteractionDriver<
  Start = PointerDown
> = {
  kind: string
  priority?: number
  resolve: (input: PointerDown) => Start | null
  start: (input: Start) => boolean
  cancel?: () => void
}

