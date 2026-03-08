import { atom } from 'jotai'
import type { InternalWhiteboardInstance } from '../instance/types'

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

const readSnapshot = (instance: InternalWhiteboardInstance) => instance.uiStore.get(sessionLockAtom)

const writeSnapshot = (instance: InternalWhiteboardInstance, next: SessionLockSnapshot) => {
  instance.uiStore.set(sessionLockAtom, next)
}

const setSnapshot = (instance: InternalWhiteboardInstance, next: SessionLockSnapshot) => {
  const snapshot = readSnapshot(instance)
  if (snapshot.active === next.active) return
  writeSnapshot(instance, next)
}

export const sessionLockState = {
  subscribe: (instance: InternalWhiteboardInstance, listener: () => void) =>
    instance.uiStore.sub(sessionLockAtom, listener),
  getSnapshot: (instance: InternalWhiteboardInstance) => readSnapshot(instance),
  tryAcquire: (
    instance: InternalWhiteboardInstance,
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
  release: (instance: InternalWhiteboardInstance, token: SessionLockToken) => {
    const snapshot = readSnapshot(instance)
    if (!snapshot.active) return
    if (snapshot.active.id !== token.id) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  },
  forceReset: (instance: InternalWhiteboardInstance) => {
    const snapshot = readSnapshot(instance)
    if (!snapshot.active) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}
