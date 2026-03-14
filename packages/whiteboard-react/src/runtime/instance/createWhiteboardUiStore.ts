import { createStore } from 'jotai/vanilla'
import type { Viewport } from '@whiteboard/core/types'
import {
  DEFAULT_VIEWPORT,
  viewportAtom
} from '../viewport/atoms'
import {
  DEFAULT_VIEWPORT_LIMITS,
  copyViewport,
  normalizeViewport
} from '../viewport/logic'

export const createWhiteboardUiStore = ({
  initialViewport = DEFAULT_VIEWPORT
}: {
  initialViewport?: Viewport
} = {}) => {
  const store = createStore()
  store.set(
    viewportAtom,
    normalizeViewport(copyViewport(initialViewport), DEFAULT_VIEWPORT_LIMITS)
  )
  return store
}
