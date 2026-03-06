import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type { WriteInput } from '@engine-types/command/api'
import type { Rebuild } from '@engine-types/read/change'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { Node, NodeId, NodePatch } from '@whiteboard/core/types'
import { getNodeAABB } from '@whiteboard/core/geometry'
import {
  expandGroupRect,
  getNodesBoundingRect,
  rectEquals
} from '@whiteboard/core/node'
import { DEFAULT_TUNING } from '../../config'

type AutofitOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
}

type LayoutSnapshot = {
  nodeWidth: number
  nodeHeight: number
  groupPadding: number
}

type PendingChange = {
  rebuild: Rebuild
  nodeIds: Set<NodeId>
}

type RebuildChange = {
  rebuild: Rebuild
  nodeIds: Set<NodeId>
}

type NodeIndexes = {
  nodeMap: ReadonlyMap<NodeId, Node>
  childrenByParentId: ReadonlyMap<NodeId, readonly Node[]>
  groups: readonly Node[]
}

type GroupUpdate = {
  id: NodeId
  patch: NodePatch
}

const toLayoutSnapshot = (
  nodeSize: { width: number; height: number },
  groupPadding: number
): LayoutSnapshot => ({
  nodeWidth: nodeSize.width,
  nodeHeight: nodeSize.height,
  groupPadding
})

const isLayoutChanged = (
  previous: LayoutSnapshot | null,
  nodeSize: { width: number; height: number },
  groupPadding: number
): boolean => {
  if (!previous) return false
  return (
    previous.nodeWidth !== nodeSize.width ||
    previous.nodeHeight !== nodeSize.height ||
    previous.groupPadding !== groupPadding
  )
}

const createIndexes = (nodes: readonly Node[]): NodeIndexes => {
  const nodeMap = new Map<NodeId, Node>()
  const childrenByParentId = new Map<NodeId, Node[]>()
  const groups: Node[] = []

  nodes.forEach((node) => {
    nodeMap.set(node.id, node)
    if (node.type === 'group') {
      groups.push(node)
    }
    if (!node.parentId) return
    const bucket = childrenByParentId.get(node.parentId)
    if (bucket) {
      bucket.push(node)
      return
    }
    childrenByParentId.set(node.parentId, [node])
  })

  return {
    nodeMap,
    childrenByParentId,
    groups
  }
}

const resolveGroupsToProcess = ({
  groups,
  prevNodeMap,
  nextNodeMap,
  change
}: {
  groups: readonly Node[]
  prevNodeMap: ReadonlyMap<NodeId, Node> | null
  nextNodeMap: ReadonlyMap<NodeId, Node>
  change: RebuildChange
}): readonly Node[] => {
  if (change.rebuild === 'full') {
    return groups
  }

  const touchedGroups = new Set<NodeId>()
  change.nodeIds.forEach((id) => {
    const current = nextNodeMap.get(id)
    const previous = prevNodeMap?.get(id)
    const parentIds = [current?.parentId, previous?.parentId]
    parentIds.forEach((parentId) => {
      if (!parentId) return
      const parent = nextNodeMap.get(parentId)
      if (parent?.type === 'group') {
        touchedGroups.add(parent.id)
      }
    })
    if (current?.type === 'group') {
      touchedGroups.add(current.id)
    }
    if (previous?.type === 'group') {
      touchedGroups.add(previous.id)
    }
  })

  return groups.filter(group => touchedGroups.has(group.id))
}

const createAutoFitUpdate = ({
  indexes,
  group,
  nodeSize,
  defaultPadding
}: {
  indexes: NodeIndexes
  group: Node
  nodeSize: { width: number; height: number }
  defaultPadding: number
}): GroupUpdate | null => {
  const padding = typeof group.groupPadding === 'number'
    ? group.groupPadding
    : defaultPadding
  const children = indexes.childrenByParentId.get(group.id) ?? []
  if (!children.length) return null

  const contentRect = getNodesBoundingRect(children, nodeSize)
  if (!contentRect) return null

  const groupRect = getNodeAABB(group, nodeSize)
  const expanded = expandGroupRect(groupRect, contentRect, padding)
  if (rectEquals(expanded, groupRect, DEFAULT_TUNING.group.rectEpsilon)) return null

  return {
    id: group.id,
    patch: {
      position: { x: expanded.x, y: expanded.y },
      size: { width: expanded.width, height: expanded.height }
    }
  }
}

export class Autofit {
  private readonly instance: AutofitOptions['instance']
  private prevNodeMap: ReadonlyMap<NodeId, Node> | null = null
  private layoutSnapshot: LayoutSnapshot | null = null
  private lastDocId: string | undefined
  private pending: PendingChange = {
    rebuild: 'none',
    nodeIds: new Set<NodeId>()
  }

  constructor({ instance }: AutofitOptions) {
    this.instance = instance
  }

  seed = (): boolean => this.promoteFull()

  ingest = (invalidation: ReadInvalidation): boolean => {
    const indexChange = invalidation.index
    if (indexChange.rebuild === 'none') return false

    if (indexChange.rebuild === 'full' || indexChange.nodeIds.length === 0) {
      return this.promoteFull()
    }

    return this.promoteDirty(indexChange.nodeIds)
  }

  flush = (): WriteInput | null => {
    const pending = this.takePending()
    if (pending.rebuild === 'none') return null
    const doc = this.instance.document.get()
    const nodeSize = this.instance.config.nodeSize
    const padding = this.instance.config.node.groupPadding

    const docChanged = this.resetStateForDoc(doc.id)
    const indexes = createIndexes(doc.nodes)
    const layoutChanged = isLayoutChanged(this.layoutSnapshot, nodeSize, padding)
    const rebuild = (docChanged || layoutChanged) ? 'full' : pending.rebuild
    const change: RebuildChange = {
      rebuild,
      nodeIds: pending.nodeIds
    }
    const groupsToProcess = resolveGroupsToProcess({
      groups: indexes.groups,
      prevNodeMap: this.prevNodeMap,
      nextNodeMap: indexes.nodeMap,
      change
    })

    const updates = groupsToProcess
      .map(group => createAutoFitUpdate({ indexes, group, nodeSize, defaultPadding: padding }))
      .filter((u): u is GroupUpdate => u !== null)

    this.prevNodeMap = indexes.nodeMap
    this.layoutSnapshot = toLayoutSnapshot(nodeSize, padding)

    if (!updates.length) return null

    return {
      domain: 'node',
      command: {
        type: 'updateMany',
        updates: updates.map((update) => ({
          id: update.id,
          patch: update.patch
        }))
      },
      source: 'system'
    }
  }

  private resetStateForDoc = (docId: string): boolean => {
    const docChanged = docId !== this.lastDocId
    if (!docChanged) return false
    this.prevNodeMap = null
    this.layoutSnapshot = null
    this.lastDocId = docId
    return true
  }

  private promoteFull = (): boolean => {
    if (this.pending.rebuild === 'full') return false
    this.pending = {
      rebuild: 'full',
      nodeIds: new Set<NodeId>()
    }
    return true
  }

  private promoteDirty = (nodeIds: readonly NodeId[]): boolean => {
    if (this.pending.rebuild === 'full') return false
    let changed = this.pending.rebuild !== 'dirty'
    this.pending.rebuild = 'dirty'
    nodeIds.forEach((id) => {
      if (this.pending.nodeIds.has(id)) return
      this.pending.nodeIds.add(id)
      changed = true
    })
    return changed
  }

  private takePending = (): PendingChange => {
    const pending = this.pending
    this.pending = {
      rebuild: 'none',
      nodeIds: new Set<NodeId>()
    }
    return pending
  }
}
