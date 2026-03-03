import type { Node, Operation } from '@whiteboard/core/types'
import type { Size } from '@engine-types/common/base'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { WriteCommandsApi } from '@engine-types/write/commands'
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

type Snapshot = {
  nodeMap: Map<string, Node>
}

type LayoutSnapshot = {
  width: number
  height: number
  padding: number
}

type Indexes = {
  nodeMap: Map<string, Node>
  childrenMap: Map<string, Node[]>
  groups: Node[]
}

type RebuildMode = 'none' | 'dirty' | 'full'

type RebuildPlan = {
  rebuild: RebuildMode
  dirtyNodeIds: ReadonlySet<string>
}

type RuntimeOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
  applyWrite: WriteCommandsApi['apply']
  scheduler: Scheduler
}

const createIndexes = (nodes: Node[]): Indexes => {
  const nodeMap = new Map<string, Node>()
  const childrenMap = new Map<string, Node[]>()
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

const createSnapshot = (indexes: Indexes): Snapshot => {
  return {
    nodeMap: indexes.nodeMap
  }
}

const addGroupAncestors = (nodeId: string, map: Map<string, Node>, target: Set<string>) => {
  let cursor: string | undefined = nodeId
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
  changedNodeIds: Iterable<string>,
  prev: Snapshot,
  next: Snapshot
): Set<string> => {
  const dirtyGroupIds = new Set<string>()

  for (const nodeId of changedNodeIds) {
    const prevNode = prev.nodeMap.get(nodeId)
    const nextNode = next.nodeMap.get(nodeId)

    if (prevNode) {
      addGroupAncestors(prevNode.id, prev.nodeMap, dirtyGroupIds)
    }

    if (nextNode) {
      addGroupAncestors(nextNode.id, next.nodeMap, dirtyGroupIds)
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
  prevSnapshot,
  currentSnapshot,
  plan
}: {
  groups: Node[]
  prevSnapshot: Snapshot | null
  currentSnapshot: Snapshot
  plan: RebuildPlan
}): Node[] => {
  if (!groups.length) return []
  if (!prevSnapshot || plan.rebuild === 'full') {
    return groups
  }
  if (plan.rebuild !== 'dirty' || plan.dirtyNodeIds.size === 0) return []
  const dirtyGroupIds = collectDirtyGroupIds(
    plan.dirtyNodeIds,
    prevSnapshot,
    currentSnapshot
  )
  if (!dirtyGroupIds.size) return []

  return groups.filter((group) => dirtyGroupIds.has(group.id))
}

const getDescendants = (indexes: Indexes, groupId: string): Node[] => {
  const result: Node[] = []
  const stack = [...(indexes.childrenMap.get(groupId) ?? [])]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    result.push(node)
    const children = indexes.childrenMap.get(node.id)
    if (children?.length) {
      children.forEach((child) => stack.push(child))
    }
  }
  return result
}

const createAutoFitOperation = ({
  indexes,
  group,
  nodeSize,
  defaultPadding
}: {
  indexes: Indexes
  group: Node
  nodeSize: Size
  defaultPadding: number
}): Operation | null => {
  const autoFit = group.data && typeof group.data.autoFit === 'string' ? group.data.autoFit : 'expand-only'
  if (autoFit === 'manual') return null

  const groupPadding = group.data && typeof group.data.padding === 'number' ? group.data.padding : defaultPadding
  const children = getDescendants(indexes, group.id)
  if (!children.length) return null

  const contentRect = getNodesBoundingRect(children, nodeSize)
  if (!contentRect) return null

  const groupRect = getNodeAABB(group, nodeSize)
  const expanded = expandGroupRect(groupRect, contentRect, groupPadding)
  if (rectEquals(expanded, groupRect, DEFAULT_TUNING.group.rectEpsilon)) return null

  return {
    type: 'node.update',
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
  private readonly applyWrite: RuntimeOptions['applyWrite']
  private snapshot: Snapshot | null = null
  private layoutSnapshot: LayoutSnapshot | null = null
  private lastDocId: string | undefined
  private disposed = false
  private pendingRebuildMode: RebuildMode = 'none'
  private readonly pendingDirtyNodeIds = new Set<string>()
  private offChange: (() => void) | null = null
  private readonly syncTask: MicrotaskTask

  constructor({ instance, applyWrite, scheduler }: RuntimeOptions) {
    this.instance = instance
    this.applyWrite = applyWrite
    this.syncTask = new MicrotaskTask(scheduler, this.triggerSync)
  }

  start = (changeBus: ChangeBus) => {
    if (this.disposed || this.offChange) return
    this.offChange = changeBus.subscribe((meta) => {
      this.handleCommit(meta)
    })
    this.syncTask.schedule()
  }

  private runSync = () => {
    const doc = this.instance.document.get()
    const docId = doc.id
    const nodes = doc.nodes
    const nodeSize = this.instance.config.nodeSize
    const padding = this.instance.config.node.groupPadding
    const docChanged = docId !== this.lastDocId
    if (docChanged) {
      this.snapshot = null
      this.layoutSnapshot = null
      this.lastDocId = docId
    }

    const indexes = createIndexes(nodes)
    const currentSnapshot = createSnapshot(indexes)
    const layoutChanged = isLayoutChanged(this.layoutSnapshot, nodeSize, padding)
    const rebuildPlan = this.consumeRebuildPlan({
      docChanged,
      layoutChanged
    })
    const nextLayout = toLayoutSnapshot(nodeSize, padding)
    const groupsToProcess = resolveGroupsToProcess({
      groups: indexes.groups,
      prevSnapshot: this.snapshot,
      currentSnapshot,
      plan: rebuildPlan
    })

    const operations: Operation[] = []
    groupsToProcess.forEach((group) => {
      const operation = createAutoFitOperation({
        indexes,
        group,
        nodeSize,
        defaultPadding: padding
      })
      if (operation) {
        operations.push(operation)
      }
    })
    if (operations.length) {
      operations.forEach((operation) => {
        if (operation.type !== 'node.update') return
        void this.applyWrite({
          domain: 'node',
          command: {
            type: 'update',
            id: operation.id,
            patch: operation.patch
          },
          source: 'system'
        })
      })
    }

    this.snapshot = currentSnapshot
    this.layoutSnapshot = nextLayout
  }

  private consumeRebuildPlan = ({
    docChanged,
    layoutChanged
  }: {
    docChanged: boolean
    layoutChanged: boolean
  }): RebuildPlan => {
    const rebuild = this.pendingRebuildMode
    const dirtyNodeIds = new Set(this.pendingDirtyNodeIds)

    this.pendingRebuildMode = 'none'
    this.pendingDirtyNodeIds.clear()

    if (docChanged || layoutChanged) {
      return {
        rebuild: 'full',
        dirtyNodeIds
      }
    }

    if (rebuild === 'dirty' && dirtyNodeIds.size === 0) {
      return {
        rebuild: 'none',
        dirtyNodeIds
      }
    }

    return {
      rebuild,
      dirtyNodeIds
    }
  }

  private triggerSync = () => {
    if (this.disposed) return
    this.runSync()
  }

  private scheduleSync = () => {
    if (this.disposed) return
    this.syncTask.schedule()
  }

  dispose = () => {
    if (this.disposed) return
    this.disposed = true
    this.offChange?.()
    this.offChange = null
    this.syncTask.cancel()
  }

  private handleCommit = (meta: Change) => {
    const indexPlan = meta.readHints.index
    if (indexPlan.mode === 'none') return

    if (indexPlan.mode === 'full') {
      this.pendingRebuildMode = 'full'
      this.pendingDirtyNodeIds.clear()
      this.scheduleSync()
      return
    }

    const dirtyNodeIds = indexPlan.dirtyNodeIds
    if (!dirtyNodeIds.length) {
      this.pendingRebuildMode = 'full'
      this.pendingDirtyNodeIds.clear()
      this.scheduleSync()
      return
    }

    if (this.pendingRebuildMode !== 'full') {
      this.pendingRebuildMode = 'dirty'
    }
    dirtyNodeIds.forEach((id) => {
      this.pendingDirtyNodeIds.add(id)
    })
    this.scheduleSync()
  }
}
