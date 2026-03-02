import type { Node, Operation } from '@whiteboard/core/types'
import type { Size } from '@engine-types/common/base'
import type { InternalInstance } from '@engine-types/instance/engine'
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
import { isSameNumberish } from '@whiteboard/core/utils'

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

type RuntimeOptions = {
  instance: Pick<InternalInstance, 'document' | 'config' | 'mutate'>
  scheduler: Scheduler
}

const isSameNodeForAutofit = (left?: Node, right?: Node) => {
  if (left === right) return true
  if (!left || !right) return false

  const leftAutoFit = left.data && typeof left.data.autoFit === 'string' ? left.data.autoFit : undefined
  const rightAutoFit = right.data && typeof right.data.autoFit === 'string' ? right.data.autoFit : undefined
  const leftPadding = left.data && typeof left.data.padding === 'number' ? left.data.padding : undefined
  const rightPadding = right.data && typeof right.data.padding === 'number' ? right.data.padding : undefined
  const leftRotation = typeof left.rotation === 'number' ? left.rotation : undefined
  const rightRotation = typeof right.rotation === 'number' ? right.rotation : undefined

  return left.type === right.type
    && left.parentId === right.parentId
    && isSameNumberish(left.position.x, right.position.x)
    && isSameNumberish(left.position.y, right.position.y)
    && isSameNumberish(left.size?.width, right.size?.width)
    && isSameNumberish(left.size?.height, right.size?.height)
    && isSameNumberish(leftRotation, rightRotation)
    && leftAutoFit === rightAutoFit
    && isSameNumberish(leftPadding, rightPadding)
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

const collectChangedNodeIds = (prev: Snapshot, next: Snapshot): Set<string> => {
  const changedIds = new Set<string>()
  const allIds = new Set<string>()
  prev.nodeMap.forEach((_value, id) => allIds.add(id))
  next.nodeMap.forEach((_value, id) => allIds.add(id))

  allIds.forEach((id) => {
    if (!isSameNodeForAutofit(prev.nodeMap.get(id), next.nodeMap.get(id))) {
      changedIds.add(id)
    }
  })

  return changedIds
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

const collectDirtyGroupIds = (changedNodeIds: Set<string>, prev: Snapshot, next: Snapshot): Set<string> => {
  const dirtyGroupIds = new Set<string>()

  changedNodeIds.forEach((nodeId) => {
    const prevNode = prev.nodeMap.get(nodeId)
    const nextNode = next.nodeMap.get(nodeId)

    if (prevNode) {
      addGroupAncestors(prevNode.id, prev.nodeMap, dirtyGroupIds)
    }

    if (nextNode) {
      addGroupAncestors(nextNode.id, next.nodeMap, dirtyGroupIds)
    }
  })

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
  layoutChanged,
  forceFullSync,
  pendingDirtyNodeIds,
  pendingDiff
}: {
  groups: Node[]
  prevSnapshot: Snapshot | null
  currentSnapshot: Snapshot
  layoutChanged: boolean
  forceFullSync: boolean
  pendingDirtyNodeIds: Set<string>
  pendingDiff: boolean
}): Node[] => {
  if (!groups.length) return []
  if (!prevSnapshot || layoutChanged || forceFullSync) {
    return groups
  }

  const dirtyGroupIds = new Set<string>()

  if (pendingDirtyNodeIds.size) {
    const fromDirtyNodes = collectDirtyGroupIds(pendingDirtyNodeIds, prevSnapshot, currentSnapshot)
    fromDirtyNodes.forEach((id) => dirtyGroupIds.add(id))
  }

  if (pendingDiff) {
    const changedNodeIds = collectChangedNodeIds(prevSnapshot, currentSnapshot)
    if (changedNodeIds.size) {
      const fromDiff = collectDirtyGroupIds(changedNodeIds, prevSnapshot, currentSnapshot)
      fromDiff.forEach((id) => dirtyGroupIds.add(id))
    }
  }

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
  private snapshot: Snapshot | null = null
  private layoutSnapshot: LayoutSnapshot | null = null
  private lastDocId: string | undefined
  private disposed = false
  private forceFullSync = true
  private pendingDiff = false
  private readonly pendingDirtyNodeIds = new Set<string>()
  private offChange: (() => void) | null = null
  private readonly syncTask: MicrotaskTask

  constructor({ instance, scheduler }: RuntimeOptions) {
    this.instance = instance
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
    let forceFullSync = this.forceFullSync
    let pendingDiff = this.pendingDiff
    const pendingDirtyNodeIds = new Set(this.pendingDirtyNodeIds)
    this.forceFullSync = false
    this.pendingDiff = false
    this.pendingDirtyNodeIds.clear()

    if (docId !== this.lastDocId) {
      this.snapshot = null
      this.layoutSnapshot = null
      this.lastDocId = docId
      forceFullSync = true
      pendingDiff = false
      pendingDirtyNodeIds.clear()
    }

    const indexes = createIndexes(nodes)
    const currentSnapshot = createSnapshot(indexes)
    const nextLayout = toLayoutSnapshot(nodeSize, padding)
    const groupsToProcess = resolveGroupsToProcess({
      groups: indexes.groups,
      prevSnapshot: this.snapshot,
      currentSnapshot,
      layoutChanged: isLayoutChanged(this.layoutSnapshot, nodeSize, padding),
      forceFullSync,
      pendingDirtyNodeIds,
      pendingDiff
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
      void this.instance.mutate(operations, 'system')
    }

    this.snapshot = currentSnapshot
    this.layoutSnapshot = nextLayout
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
    const hasRelevantChange =
      meta.kind === 'replace'
      || meta.impact.tags.has('full')
      || meta.impact.tags.has('nodes')
      || meta.impact.tags.has('geometry')
      || meta.impact.tags.has('order')
      || Boolean(meta.impact.dirtyNodeIds?.length)
    if (!hasRelevantChange) return
    if (meta.kind === 'replace' || meta.impact.tags.has('full')) {
      this.forceFullSync = true
      this.pendingDiff = false
      this.pendingDirtyNodeIds.clear()
      this.scheduleSync()
      return
    }

    if (meta.impact.dirtyNodeIds?.length) {
      meta.impact.dirtyNodeIds.forEach((id) => {
        this.pendingDirtyNodeIds.add(id)
      })
    } else {
      this.pendingDiff = true
    }

    this.scheduleSync()
  }
}
