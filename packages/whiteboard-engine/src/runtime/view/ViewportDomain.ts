import type { State } from '@engine-types/instance/state'
import type { ViewportTransformView } from '@engine-types/instance/view'
import type { Viewport } from '@whiteboard/core/types'

type Options = {
  state: Pick<State, 'read'>
}

export type ViewportDomain = {
  sync: () => boolean
  getTransform: () => ViewportTransformView
}

const toViewportTransformView = (viewport: Viewport): ViewportTransformView => {
  const zoom = viewport.zoom
  return {
    center: viewport.center,
    zoom,
    transform: `translate(50%, 50%) scale(${zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
    cssVars: {
      '--wb-zoom': `${zoom}`
    }
  }
}

export const createViewportDomain = ({ state }: Options): ViewportDomain => {
  let transform = toViewportTransformView(state.read('viewport'))

  const sync = () => {
    const next = toViewportTransformView(state.read('viewport'))
    const prev = transform
    const changed =
      prev.zoom !== next.zoom ||
      prev.center.x !== next.center.x ||
      prev.center.y !== next.center.y
    transform = next
    return changed
  }

  const getTransform = () => transform

  return {
    sync,
    getTransform
  }
}
