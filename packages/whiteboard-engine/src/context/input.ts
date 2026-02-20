import type { ViewportApi } from '@engine-types/instance/runtime'
import type {
  PointerInput,
  PointerModifiers
} from './types'
import {
  readPointerModifiers as readPointerModifiersRaw,
  toPointerInputFromDomEvent
} from '../input/shared/pointer'

export const readPointerModifiers = (
  event: Pick<PointerEvent, 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>
): PointerModifiers => readPointerModifiersRaw(event)

export const toPointerInput = (
  viewport: Pick<ViewportApi, 'clientToScreen' | 'clientToWorld'>,
  event: PointerEvent
): PointerInput => toPointerInputFromDomEvent(viewport, event)
