import { createValueStore } from '@whiteboard/core/runtime'
import type {
  ActiveInteraction,
  ActiveInteractionMode,
  InteractionCoordinator,
  InteractionMode,
  InteractionSpec,
  InteractionToken
} from './types'

const DEFAULT_SPEC: InteractionSpec = {
  menu: 'block',
  viewport: 'block',
  pan: 'none'
}

const specByMode: Record<ActiveInteractionMode, InteractionSpec> = {
  'viewport-gesture': DEFAULT_SPEC,
  'selection-box': {
    ...DEFAULT_SPEC,
    pan: 'viewport'
  },
  'node-drag': {
    ...DEFAULT_SPEC,
    pan: 'viewport'
  },
  'mindmap-drag': {
    ...DEFAULT_SPEC,
    pan: 'viewport'
  },
  'node-transform': DEFAULT_SPEC,
  'edge-connect': {
    ...DEFAULT_SPEC,
    pan: 'viewport'
  },
  'edge-routing': {
    ...DEFAULT_SPEC,
    pan: 'viewport'
  }
}

export const createInteractionCoordinator = (): InteractionCoordinator => {
  const mode = createValueStore<InteractionMode>('idle')
  let nextId = 1
  let active: ActiveInteraction | null = null

  return {
    mode,
    current: () => active,
    tryStart: ({ mode: nextMode, cancel, pointerId }) => {
      if (active) {
        return null
      }

      const token: InteractionToken = {
        id: nextId++
      }
      active = {
        token,
        mode: nextMode,
        cancel,
        pointerId,
        spec: specByMode[nextMode]
      }
      mode.set(nextMode)
      return token
    },
    finish: (token) => {
      if (active?.token !== token) {
        return
      }

      active = null
      mode.set('idle')
    },
    cancel: () => {
      active?.cancel()
    }
  }
}
