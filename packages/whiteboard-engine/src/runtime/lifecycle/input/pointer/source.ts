import type { PointerInput } from '@engine-types/common'
import type { ViewportApi } from '@engine-types/instance/runtime'
import { toPointerInput } from '../../../../context'

export type PointerLifecyclePhase = 'move' | 'up' | 'cancel'

export type PointerLifecycleEvent = {
  phase: PointerLifecyclePhase
  pointer: PointerInput
  nativeEvent: PointerEvent
}

export const toPointerLifecycleEvent = (
  viewport: Pick<ViewportApi, 'clientToScreen' | 'clientToWorld'>,
  phase: PointerLifecyclePhase,
  nativeEvent: PointerEvent
): PointerLifecycleEvent => ({
  phase,
  pointer: toPointerInput(viewport, nativeEvent),
  nativeEvent
})
