import { atom } from 'jotai/vanilla'
import type { Viewport } from '@whiteboard/core/types'

export const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

export const viewportAtom = atom<Viewport>(DEFAULT_VIEWPORT)

export const viewportZoomAtom = atom((get) => get(viewportAtom).zoom)
