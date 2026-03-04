import type { Node, NodeId } from '@whiteboard/core/types'
import type { Size } from '@engine-types/common/base'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { Apply } from '@engine-types/write/commands'
import type { Scheduler } from '../../runtime/Scheduler'
import { MicrotaskTask } from '../../runtime/TaskQueue'
import { DEFAULT_TUNING } from '../../config'
import type { Change, Bus as ChangeBus } from '@engine-types/write/change'
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
  apply: Apply
  scheduler: Scheduler
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
  readonly name = 'Autofit'

  private readonly instance: RuntimeOptions['instance']
  private readonly apply: RuntimeOptions['apply']
  private prevNodeMap: ReadonlyMap<NodeId, Node> | null = null
  private layoutSnapshot: LayoutSnapshot | null = null
  private lastDocId: string | undefined
  private disposed = false
  private readonly pendingPlan: PendingRebuildPlan = {
    rebuild: 'none',
    dirtyNodeIds: new Set<NodeId>()
  }
  private offChange: (() => void) | null = null
  private readonly syncTask: MicrotaskTask

  constructor({ instance, apply, scheduler }: RuntimeOptions) {
    this.instance = instance
    this.apply = apply
    this.syncTask = new MicrotaskTask(scheduler, () => {
      if (!this.disposed) this.runSync()
    })
  }

  start = (changeBus: ChangeBus) => {
    if (this.disposed || this.offChange) return
    this.offChange = changeBus.subscribe(this.handleCommit)
    this.syncTask.schedule()
  }

  private resetStateForDoc = (docId: string): boolean => {
    const docChanged = docId !== this.lastDocId
    if (!docChanged) return false
    this.prevNodeMap = null
    this.layoutSnapshot = null
    this.lastDocId = docId
    return true
  }


  private runSync = () => {
    const doc = this.instance.document.get()
    const nodeSize = this.instance.config.nodeSize
    const padding = this.instance.config.node.groupPadding
    const docChanged = this.resetStateForDoc(doc.id)

    const indexes = createIndexes(doc.nodes)
    const layoutChanged = isLayoutChanged(this.layoutSnapshot, nodeSize, padding)
    const rebuildPlan = this.consumeRebuildPlan({
      docChanged,
      layoutChanged
    })
    const groupsToProcess = resolveGroupsToProcess({
      groups: indexes.groups,
      prevNodeMap: this.prevNodeMap,
      nextNodeMap: indexes.nodeMap,
      plan: rebuildPlan
    })

    const updates = groupsToProcess
      .map(group => createAutoFitUpdate({ indexes, group, nodeSize, defaultPadding: padding }))
      .filter((u): u is GroupUpdate => u !== null)

    if (updates.length) {
      void this.apply({
        domain: 'node',
        command: {
          type: 'updateMany',
          updates: updates.map((update) => ({
            id: update.id,
            patch: update.patch
          }))
        },
        source: 'system'
      })
    }

    this.prevNodeMap = indexes.nodeMap
    this.layoutSnapshot = toLayoutSnapshot(nodeSize, padding)
  }

  private consumeRebuildPlan = ({
    docChanged,
    layoutChanged
  }: {
    docChanged: boolean
    layoutChanged: boolean
  }): RebuildPlan => {
    const rebuild = this.pendingPlan.rebuild
    const dirtyNodeIds = new Set(this.pendingPlan.dirtyNodeIds)

    this.pendingPlan.rebuild = 'none'
    this.pendingPlan.dirtyNodeIds.clear()

    if (docChanged || layoutChanged) return { rebuild: 'full', dirtyNodeIds }

    const effective = (rebuild === 'dirty' && dirtyNodeIds.size === 0) ? 'none' : rebuild
    return { rebuild: effective, dirtyNodeIds }
  }

  private enqueueFullRebuild = () => {
    this.pendingPlan.rebuild = 'full'
    this.pendingPlan.dirtyNodeIds.clear()
    if (!this.disposed) this.syncTask.schedule()
  }

  private enqueueDirtyRebuild = (dirtyNodeIds: readonly NodeId[]) => {
    if (this.pendingPlan.rebuild !== 'full') {
      this.pendingPlan.rebuild = 'dirty'
    }
    dirtyNodeIds.forEach((id) => {
      this.pendingPlan.dirtyNodeIds.add(id)
    })
    if (!this.disposed) this.syncTask.schedule()
  }

  dispose = () => {
    if (this.disposed) return
    this.disposed = true
    this.offChange?.()
    this.offChange = null
    this.syncTask.cancel()
  }

  private handleCommit = (change: Change) => {
    const indexPlan = change.readHints.index
    if (indexPlan.mode === 'none') return

    if (indexPlan.mode === 'full' || indexPlan.dirtyNodeIds.length === 0) {
      this.enqueueFullRebuild()
      return
    }

    this.enqueueDirtyRebuild(indexPlan.dirtyNodeIds)
  }
}
