import type {
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { WriteInput } from '@engine-types/command/api'
import type { Size } from '@engine-types/common/base'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { Change } from '@engine-types/write/change'
import { DEFAULT_TUNING } from '../../config'
import { getNodeAABB } from '@whiteboard/core/geometry'
import {
  expandGroupRect,
  getNodesBoundingRect,
  rectEquals
} from '@whiteboard/core/node'

type LayoutSnapshot = {
  width: number
  height: number
  padding: number
}

type Indexes = {
  nodeMap: Map<NodeId, Node>
  childrenMap: Map<NodeId, Node[]>
  groups: Node[]
}

type RebuildMode = 'none' | 'dirty' | 'full'

type RebuildPlan = {
  rebuild: RebuildMode
  dirtyNodeIds: ReadonlySet<NodeId>
}

type PendingRebuildPlan = {
  rebuild: RebuildMode
  dirtyNodeIds: Set<NodeId>
}

type GroupUpdate = {
  id: NodeId
  patch: {
    position: { x: number; y: number }
    size: { width: number; height: number }
  }
}

type RuntimeOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
}

const createIndexes = (nodes: readonly Node[]): Indexes => {
  const nodeMap = new Map<NodeId, Node>()
  const childrenMap = new Map<NodeId, Node[]>()
  const groups: Node[] = []

  nodes.forEach((node) => {
    nodeMap.set(node.id, node)
    if (node.type === 'group') {
      groups.push(node)
    }
    if (!node.parentId) return
    const list = childrenMap.get(node.parentId) ?? []
    list.push(node)
    childrenMap.set(node.parentId, list)
  })

  return {
    nodeMap,
    childrenMap,
    groups
  }
}

const addGroupAncestors = (
  nodeId: NodeId,
  map: ReadonlyMap<NodeId, Node>,
  target: Set<NodeId>
) => {
  let cursor: NodeId | undefined = nodeId
  while (cursor) {
    const current = map.get(cursor)
    if (!current) break
    if (current.type === 'group') {
      target.add(current.id)
    }
    cursor = current.parentId
  }
}

const collectDirtyGroupIds = (
  changedNodeIds: Iterable<NodeId>,
  prevNodeMap: ReadonlyMap<NodeId, Node>,
  nextNodeMap: ReadonlyMap<NodeId, Node>
): Set<NodeId> => {
  const dirtyGroupIds = new Set<NodeId>()

  for (const nodeId of changedNodeIds) {
    const prevNode = prevNodeMap.get(nodeId)
    const nextNode = nextNodeMap.get(nodeId)

    if (prevNode) {
      addGroupAncestors(prevNode.id, prevNodeMap, dirtyGroupIds)
    }

    if (nextNode) {
      addGroupAncestors(nextNode.id, nextNodeMap, dirtyGroupIds)
    }
  }

  return dirtyGroupIds
}

const isLayoutChanged = (prevLayout: LayoutSnapshot | null, nodeSize: Size, padding: number) =>
  !prevLayout ||
  prevLayout.width !== nodeSize.width ||
  prevLayout.height !== nodeSize.height ||
  prevLayout.padding !== padding

const toLayoutSnapshot = (nodeSize: Size, padding: number): LayoutSnapshot => ({
  width: nodeSize.width,
  height: nodeSize.height,
  padding
})

const resolveGroupsToProcess = ({
  groups,
  prevNodeMap,
  nextNodeMap,
  plan
}: {
  groups: readonly Node[]
  prevNodeMap: ReadonlyMap<NodeId, Node> | null
  nextNodeMap: ReadonlyMap<NodeId, Node>
  plan: RebuildPlan
}): Node[] => {
  if (!groups.length) return []
  if (plan.rebuild === 'none') return []
  if (!prevNodeMap || plan.rebuild === 'full') return [...groups]
  if (plan.rebuild !== 'dirty' || plan.dirtyNodeIds.size === 0) return []
  const dirtyGroupIds = collectDirtyGroupIds(
    plan.dirtyNodeIds,
    prevNodeMap,
    nextNodeMap
  )
  if (!dirtyGroupIds.size) return []

  return groups.filter((group) => dirtyGroupIds.has(group.id))
}

const getDescendants = (indexes: Indexes, groupId: NodeId): Node[] => {
  const result: Node[] = []
  const stack = [...(indexes.childrenMap.get(groupId) ?? [])]
  while (stack.length) {
    const node = stack.pop()!
    result.push(node)
    const children = indexes.childrenMap.get(node.id)
    if (children?.length) stack.push(...children)
  }
  return result
}

const createAutoFitUpdate = ({
  indexes,
  group,
  nodeSize,
  defaultPadding
}: {
  indexes: Indexes
  group: Node
  nodeSize: Size
  defaultPadding: number
}): GroupUpdate | null => {
  const autoFit = group.data?.autoFit ?? 'expand-only'
  if (autoFit === 'manual') return null

  const groupPadding = typeof group.data?.padding === 'number' ? group.data.padding : defaultPadding
  const children = getDescendants(indexes, group.id)
  if (!children.length) return null

  const contentRect = getNodesBoundingRect(children, nodeSize)
  if (!contentRect) return null

  const groupRect = getNodeAABB(group, nodeSize)
  const expanded = expandGroupRect(groupRect, contentRect, groupPadding)
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
  readonly topic = 'autofit'

  private readonly instance: RuntimeOptions['instance']
  private prevNodeMap: ReadonlyMap<NodeId, Node> | null = null
  private layoutSnapshot: LayoutSnapshot | null = null
  private lastDocId: string | undefined
  private pending: PendingRebuildPlan = {
    rebuild: 'none',
    dirtyNodeIds: new Set<NodeId>()
  }

  constructor({ instance }: RuntimeOptions) {
    this.instance = instance
  }

  seed = () => {
    this.promoteFull()
  }

  ingest = (change: Change) => {
    const indexPlan = change.readHints.index
    if (indexPlan.rebuild === 'none') return

    if (indexPlan.rebuild === 'full' || indexPlan.dirtyNodeIds.length === 0) {
      this.promoteFull()
      return
    }

    this.promoteDirty(indexPlan.dirtyNodeIds)
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
    const plan: RebuildPlan = {
      rebuild,
      dirtyNodeIds: pending.dirtyNodeIds
    }
    const groupsToProcess = resolveGroupsToProcess({
      groups: indexes.groups,
      prevNodeMap: this.prevNodeMap,
      nextNodeMap: indexes.nodeMap,
      plan
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

  private promoteFull = () => {
    this.pending.rebuild = 'full'
    this.pending.dirtyNodeIds.clear()
  }

  private promoteDirty = (dirtyNodeIds: readonly NodeId[]) => {
    if (this.pending.rebuild === 'full') return
    this.pending.rebuild = 'dirty'
    dirtyNodeIds.forEach((nodeId) => {
      this.pending.dirtyNodeIds.add(nodeId)
    })
  }

  private takePending = (): PendingRebuildPlan => {
    const current = this.pending
    this.pending = {
      rebuild: 'none',
      dirtyNodeIds: new Set<NodeId>()
    }
    return current
  }
}
