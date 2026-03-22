import type { ReadModel } from '@engine-types/read'
import type { NodeId } from '@whiteboard/core/types'

const EMPTY_IDS: readonly NodeId[] = []
const EMPTY_SET: ReadonlySet<NodeId> = new Set<NodeId>()

export class TreeIndex {
  private nodeById: ReadModel['canvas']['nodeById'] = new Map()
  private allIds: readonly NodeId[] = EMPTY_IDS
  private groups = new Set<NodeId>()
  private children = new Map<NodeId, NodeId[]>()
  private idsCache = new Map<NodeId, readonly NodeId[]>()
  private setCache = new Map<NodeId, ReadonlySet<NodeId>>()

  applyChange = (model: ReadModel) => {
    const nextNodeById = model.canvas.nodeById
    const nextIds = model.canvas.nodeIds

    if (this.nodeById === nextNodeById && this.allIds === nextIds) {
      return
    }

    this.nodeById = nextNodeById
    this.allIds = nextIds
    this.groups = new Set()
    this.children = new Map()
    this.idsCache.clear()
    this.setCache.clear()

    nextIds.forEach((nodeId) => {
      const node = nextNodeById.get(nodeId)
      if (!node) return

      if (node.type === 'group') {
        this.groups.add(nodeId)
      }

      const parentId = node.parentId
      if (!parentId) {
        return
      }

      const children = this.children.get(parentId) ?? []
      children.push(nodeId)
      this.children.set(parentId, children)
    })
  }

  ids = (rootId: NodeId): readonly NodeId[] => {
    const cached = this.idsCache.get(rootId)
    if (cached) {
      return cached
    }

    const ids = this.readIds(rootId)
    this.idsCache.set(rootId, ids)
    return ids
  }

  private readIds = (rootId: NodeId): readonly NodeId[] => {
    const set = this.readSet(rootId)
    if (set.size === 0) {
      return EMPTY_IDS
    }

    const ids = this.allIds.filter((nodeId) => set.has(nodeId))
    return ids.length > 0 ? ids : EMPTY_IDS
  }

  private readSet = (rootId: NodeId): ReadonlySet<NodeId> => {
    const cached = this.setCache.get(rootId)
    if (cached) {
      return cached
    }

    if (!this.nodeById.has(rootId) || !this.groups.has(rootId)) {
      this.setCache.set(rootId, EMPTY_SET)
      return EMPTY_SET
    }

    const set = new Set<NodeId>()
    const stack = [...(this.children.get(rootId) ?? EMPTY_IDS)]

    while (stack.length > 0) {
      const nodeId = stack.pop()
      if (!nodeId || set.has(nodeId)) {
        continue
      }

      set.add(nodeId)
      const children = this.children.get(nodeId)
      if (children) {
        children.forEach((childId) => {
          stack.push(childId)
        })
      }
    }

    const result = set.size > 0 ? set : EMPTY_SET
    this.setCache.set(rootId, result)
    return result
  }
}
