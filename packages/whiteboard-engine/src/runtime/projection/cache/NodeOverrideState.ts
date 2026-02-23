import type { NodeId } from '@whiteboard/core/types'
import type { NodeViewUpdate } from '@engine-types/projection'
import { isPointEqual, isSizeEqual } from '@whiteboard/core/geometry'
import type { NodeOverride } from './NodeOverride'

const isOptionalPointEqual = (
  left?: { x: number; y: number },
  right?: { x: number; y: number }
) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return isPointEqual(left, right)
}

const isOverrideEqual = (
  left?: NodeOverride,
  right?: NodeOverride
) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return (
    isOptionalPointEqual(left.position, right.position) &&
    isSizeEqual(left.size, right.size)
  )
}

export class NodeOverrideState {
  private readonly overrides = new Map<NodeId, NodeOverride>()

  readMap = () => this.overrides

  readUpdates = (): NodeViewUpdate[] =>
    Array.from(this.overrides.entries()).map(([id, override]) => ({
      id,
      ...override
    }))

  patch = (updates: NodeViewUpdate[]): NodeId[] => {
    if (!updates.length) return []
    const changedNodeIds: NodeId[] = []
    updates.forEach((update) => {
      if (!update.position && !update.size) return
      const current = this.overrides.get(update.id)
      const next: NodeOverride = {
        position: update.position ?? current?.position,
        size: update.size ?? current?.size
      }
      if (isOverrideEqual(current, next)) return
      this.overrides.set(update.id, next)
      changedNodeIds.push(update.id)
    })
    return changedNodeIds
  }

  clear = (ids?: NodeId[]): NodeId[] => {
    if (!this.overrides.size) return []
    if (!ids || !ids.length) {
      const changedNodeIds = Array.from(this.overrides.keys())
      this.overrides.clear()
      return changedNodeIds
    }

    const changedNodeIds: NodeId[] = []
    ids.forEach((id) => {
      if (!this.overrides.has(id)) return
      this.overrides.delete(id)
      changedNodeIds.push(id)
    })
    return changedNodeIds
  }
}
