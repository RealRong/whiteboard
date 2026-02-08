import type { NodeId } from '@whiteboard/core'
import type { NodeOverride, NodeViewUpdate } from 'types/state'
import { isPointEqual, isSizeEqual } from '../geometry/valueEquality'

export const updateNodeOverrides = (
  prev: Map<NodeId, NodeOverride>,
  updates: NodeViewUpdate[]
): Map<NodeId, NodeOverride> => {
  if (!updates.length) return prev
  const next = new Map(prev)
  let changed = false
  updates.forEach((update) => {
    if (!update.position && !update.size) return
    const current = next.get(update.id) ?? {}
    const merged = {
      position: update.position ?? current.position,
      size: update.size ?? current.size
    }
    if (isPointEqual(merged.position, current.position) && isSizeEqual(merged.size, current.size)) {
      return
    }
    changed = true
    next.set(update.id, merged)
  })
  return changed ? next : prev
}

export const clearNodeOverrides = (prev: Map<NodeId, NodeOverride>, ids?: NodeId[]) => {
  if (!ids || ids.length === 0) return new Map<NodeId, NodeOverride>()
  const next = new Map(prev)
  let changed = false
  ids.forEach((id) => {
    if (!next.has(id)) return
    next.delete(id)
    changed = true
  })
  return changed ? next : prev
}
