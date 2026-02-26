import { atom } from 'jotai'
import { createStore } from 'jotai/vanilla'

export type InteractionSessionKind =
  | 'viewportGesture'
  | 'selectionBox'
  | 'nodeDrag'
  | 'nodeTransform'
  | 'edgeRouting'
  | 'edgeConnect'
  | 'mindmapDrag'

export type SessionLockToken = Readonly<{
  id: number
  kind: InteractionSessionKind
  pointerId?: number
}>

type SessionLockSnapshot = {
  active?: SessionLockToken
}

const EMPTY_SNAPSHOT: SessionLockSnapshot = {}

const sessionLockAtom = atom<SessionLockSnapshot>(EMPTY_SNAPSHOT)
const sessionLockAtomStore = createStore()

let nextTokenId = 1

const setSnapshot = (next: SessionLockSnapshot) => {
  const snapshot = sessionLockAtomStore.get(sessionLockAtom)
  if (snapshot.active === next.active) return
  sessionLockAtomStore.set(sessionLockAtom, next)
}

export const sessionLockStore = {
  subscribe: (listener: () => void) =>
    sessionLockAtomStore.sub(sessionLockAtom, listener),
  getSnapshot: () => sessionLockAtomStore.get(sessionLockAtom),
  tryAcquire: (
    kind: InteractionSessionKind,
    pointerId?: number
  ): SessionLockToken | null => {
    const snapshot = sessionLockAtomStore.get(sessionLockAtom)
    if (snapshot.active) return null
    const token: SessionLockToken = {
      id: nextTokenId,
      kind,
      pointerId
    }
    nextTokenId += 1
    setSnapshot({ active: token })
    return token
  },
  release: (token: SessionLockToken) => {
    const snapshot = sessionLockAtomStore.get(sessionLockAtom)
    if (!snapshot.active) return
    if (snapshot.active.id !== token.id) return
    setSnapshot(EMPTY_SNAPSHOT)
  },
  forceReset: () => {
    const snapshot = sessionLockAtomStore.get(sessionLockAtom)
    if (!snapshot.active) return
    setSnapshot(EMPTY_SNAPSHOT)
  }
}
