import { rectFromPoints } from '@whiteboard/core/geometry'
import type { Rect } from '@whiteboard/core/types'
import {
  createDerivedStore,
  createValueStore,
  type ReadStore
} from '@whiteboard/engine'
import type { EditorViewport } from '../../types/editor'

export type MarqueeMatch = 'touch' | 'contain'

export type MarqueeFeedback = {
  rect: Rect
  match: MarqueeMatch
}

type MarqueeFeedbackInput = {
  worldRect: Rect
  match: MarqueeMatch
}

export type MarqueeFeedbackRuntime =
  Pick<ReadStore<MarqueeFeedback | undefined>, 'get' | 'subscribe'> & {
    set: (next?: MarqueeFeedbackInput) => void
    clear: () => void
  }

const projectWorldRect = (
  viewport: Pick<EditorViewport, 'worldToScreen'>,
  worldRect: Rect
): Rect => {
  const topLeft = viewport.worldToScreen({
    x: worldRect.x,
    y: worldRect.y
  })
  const bottomRight = viewport.worldToScreen({
    x: worldRect.x + worldRect.width,
    y: worldRect.y + worldRect.height
  })

  return rectFromPoints(topLeft, bottomRight)
}

export const createMarqueeFeedback = (
  viewport: Pick<EditorViewport, 'worldToScreen'> & ReadStore<unknown>
): MarqueeFeedbackRuntime => {
  const input = createValueStore<MarqueeFeedbackInput | undefined>(undefined)
  const store = createDerivedStore<MarqueeFeedback | undefined>({
    get: (read) => {
      const next = read(input)
      read(viewport)
      if (!next) {
        return undefined
      }

      return {
        rect: projectWorldRect(viewport, next.worldRect),
        match: next.match
      }
    },
    isEqual: (left, right) => (
      left === right
      || (
        left?.match === right?.match
        && left?.rect.x === right?.rect.x
        && left?.rect.y === right?.rect.y
        && left?.rect.width === right?.rect.width
        && left?.rect.height === right?.rect.height
      )
    )
  })

  return {
    get: store.get,
    subscribe: store.subscribe,
    set: (next) => {
      input.set(next)
    },
    clear: () => {
      input.set(undefined)
    }
  }
}
