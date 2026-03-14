import { atom } from 'jotai'
import { useUiAtomValue } from '../common/hooks/useUiAtom'
import type { InternalWhiteboardInstance } from '../common/instance'

export type InteractionSession =
  | { kind: 'idle' }
  | { kind: 'selection-box' }
  | { kind: 'node-drag' }
  | { kind: 'node-transform' }
  | { kind: 'edge-connect' }
  | { kind: 'edge-routing' }

export type InteractionSessionDomain = {
  state: {
    get: () => InteractionSession
  }
  commands: {
    beginSelectionBox: () => void
    beginNodeDrag: () => void
    beginNodeTransform: () => void
    beginEdgeConnect: () => void
    beginEdgeRouting: () => void
    end: () => void
  }
}

const IDLE_INTERACTION_SESSION: InteractionSession = { kind: 'idle' }
const interactionSessionAtom = atom<InteractionSession>(IDLE_INTERACTION_SESSION)
export const interactionSessionStateAtom = atom((get) => get(interactionSessionAtom))

export const useInteractionSession = (): InteractionSession =>
  useUiAtomValue(interactionSessionStateAtom)

export const createInteractionSessionDomain = ({
  uiStore
}: {
  uiStore: InternalWhiteboardInstance['uiStore']
}): InteractionSessionDomain => {
  const setSession = (next: InteractionSession) => {
    const current = uiStore.get(interactionSessionAtom)
    if (current.kind === next.kind) return
    uiStore.set(interactionSessionAtom, next)
  }

  return {
    state: {
      get: () => uiStore.get(interactionSessionAtom)
    },
    commands: {
      beginSelectionBox: () => {
        setSession({ kind: 'selection-box' })
      },
      beginNodeDrag: () => {
        setSession({ kind: 'node-drag' })
      },
      beginNodeTransform: () => {
        setSession({ kind: 'node-transform' })
      },
      beginEdgeConnect: () => {
        setSession({ kind: 'edge-connect' })
      },
      beginEdgeRouting: () => {
        setSession({ kind: 'edge-routing' })
      },
      end: () => {
        setSession(IDLE_INTERACTION_SESSION)
      }
    }
  }
}
