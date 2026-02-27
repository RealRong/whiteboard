import { atom } from 'jotai'
import type { Instance } from '@whiteboard/engine'

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

let nextTokenId = 1

const readSnapshot = (instance: Instance) => instance.runtime.store.get(sessionLockAtom)

const writeSnapshot = (instance: Instance, next: SessionLockSnapshot) => {
  instance.runtime.store.set(sessionLockAtom, next)
}

const setSnapshot = (instance: Instance, next: SessionLockSnapshot) => {
  const snapshot = readSnapshot(instance)
  if (snapshot.active === next.active) return
  writeSnapshot(instance, next)
}

export const sessionLockState = {
  subscribe: (instance: Instance, listener: () => void) =>
    instance.runtime.store.sub(sessionLockAtom, listener),
  getSnapshot: (instance: Instance) => readSnapshot(instance),
  tryAcquire: (
    instance: Instance,
    kind: InteractionSessionKind,
    pointerId?: number
  ): SessionLockToken | null => {
    const snapshot = readSnapshot(instance)
    if (snapshot.active) return null
    const token: SessionLockToken = {
      id: nextTokenId,
      kind,
      pointerId
    }
    nextTokenId += 1
    setSnapshot(instance, { active: token })
    return token
  },
  release: (instance: Instance, token: SessionLockToken) => {
    const snapshot = readSnapshot(instance)
    if (!snapshot.active) return
    if (snapshot.active.id !== token.id) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  },
  forceReset: (instance: Instance) => {
    const snapshot = readSnapshot(instance)
    if (!snapshot.active) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}
