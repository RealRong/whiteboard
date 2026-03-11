import type { createStore } from 'jotai/vanilla'
import type { InternalWhiteboardInstance } from '../instance/types'

export type InteractionLockKind =
  | 'viewportGesture'
  | 'selectionBox'
  | 'nodeDrag'
  | 'nodeTransform'
  | 'edgeRouting'
  | 'edgeConnect'
  | 'mindmapDrag'

export type InteractionLockToken = Readonly<{
  kind: InteractionLockKind
  pointerId?: number
}>

type InteractionLockStore = ReturnType<typeof createStore>
type InteractionLockTarget = InternalWhiteboardInstance | InteractionLockStore

const activeByTarget = new WeakMap<object, InteractionLockToken>()

const resolveTarget = (target: InteractionLockTarget): object =>
  'uiStore' in target ? target.uiStore : target

export const interactionLock = {
  tryAcquire: (
    target: InteractionLockTarget,
    kind: InteractionLockKind,
    pointerId?: number
  ): InteractionLockToken | null => {
    const owner = resolveTarget(target)
    if (activeByTarget.has(owner)) return null
    const token: InteractionLockToken = {
      kind,
      pointerId
    }
    activeByTarget.set(owner, token)
    return token
  },
  release: (target: InteractionLockTarget, token: InteractionLockToken) => {
    const owner = resolveTarget(target)
    if (activeByTarget.get(owner) !== token) return
    activeByTarget.delete(owner)
  },
  forceReset: (target: InteractionLockTarget) => {
    activeByTarget.delete(resolveTarget(target))
  }
}
