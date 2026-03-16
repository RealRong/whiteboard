import { createValueStore } from '@whiteboard/core/runtime'
import type {
  ActiveInteraction,
  ActiveInteractionMode,
  InteractionCoordinator,
  InteractionMode,
  InteractionPolicy,
  InteractionToken
} from './types'

const DEFAULT_POLICY: InteractionPolicy = {
  menu: 'block',
  viewport: 'block',
  pan: 'none'
}

const policyByMode: Record<ActiveInteractionMode, InteractionPolicy> = {
  'viewport-gesture': DEFAULT_POLICY,
  'selection-box': {
    ...DEFAULT_POLICY,
    pan: 'viewport'
  },
  'node-drag': {
    ...DEFAULT_POLICY,
    pan: 'viewport'
  },
  'mindmap-drag': {
    ...DEFAULT_POLICY,
    pan: 'viewport'
  },
  'node-transform': DEFAULT_POLICY,
  'edge-connect': {
    ...DEFAULT_POLICY,
    pan: 'viewport'
  },
  'edge-routing': {
    ...DEFAULT_POLICY,
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
        policy: policyByMode[nextMode]
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
