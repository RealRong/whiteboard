import type { ReadImpact } from '@engine-types/read/impact'
import type { WriteInput } from '@engine-types/command/api'
import type { Rebuild } from '@engine-types/read/change'
import type { InternalInstance } from '@engine-types/instance/engine'
import {
  listNodes,
  type Node,
  type NodeId,
  type NodePatch
} from '@whiteboard/core/types'
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

type Change = {
  rebuild: Rebuild
  nodeIds: Set<NodeId>
}

type NodeIndex = {
  nodeMap: ReadonlyMap<NodeId, Node>
  childrenByParentId: ReadonlyMap<NodeId, readonly Node[]>
  groups: readonly Node[]
}

type GroupUpdate = {
  id: NodeId
  patch: NodePatch
}

const createLayoutSnapshot = (
  nodeSize: { width: number; height: number },
  groupPadding: number
): LayoutSnapshot => ({
  nodeWidth: nodeSize.width,
  nodeHeight: nodeSize.height,
  groupPadding
})

const hasLayoutChanged = (
  previous: LayoutSnapshot | null,
  next: LayoutSnapshot
): boolean => {
  if (!previous) return false
  return (
    previous.nodeWidth !== next.nodeWidth ||
    previous.nodeHeight !== next.nodeHeight ||
    previous.groupPadding !== next.groupPadding
  )
}

const createNodeIndex = (nodes: readonly Node[]): NodeIndex => {
  const nodeMap = new Map<NodeId, Node>()
  const childrenByParentId = new Map<NodeId, Node[]>()
  const groups: Node[] = []

  nodes.forEach((node) => {
    nodeMap.set(node.id, node)
    if (node.type === 'group') {
      groups.push(node)
    }
    if (!node.parentId) return
    const children = childrenByParentId.get(node.parentId)
    if (children) {
      children.push(node)
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

const collectTouchedGroupIds = ({
  change,
  prevNodeMap,
  nextNodeMap
}: {
  change: Change
  prevNodeMap: ReadonlyMap<NodeId, Node> | null
  nextNodeMap: ReadonlyMap<NodeId, Node>
}): Set<NodeId> => {
  const groupIds = new Set<NodeId>()

  change.nodeIds.forEach((id) => {
    const current = nextNodeMap.get(id)
    const previous = prevNodeMap?.get(id)

    if (current?.type === 'group') {
      groupIds.add(current.id)
    }
    if (previous?.type === 'group') {
      groupIds.add(previous.id)
    }

    const parentIds = [current?.parentId, previous?.parentId]
    parentIds.forEach((parentId) => {
      if (!parentId) return
      const parent = nextNodeMap.get(parentId)
      if (parent?.type === 'group') {
        groupIds.add(parent.id)
      }
    })
  })

  return groupIds
}

const selectGroups = ({
  change,
  prevNodeMap,
  index
}: {
  change: Change
  prevNodeMap: ReadonlyMap<NodeId, Node> | null
  index: NodeIndex
}): readonly Node[] => {
  if (change.rebuild === 'full') {
    return index.groups
  }

  const touchedGroupIds = collectTouchedGroupIds({
    change,
    prevNodeMap,
    nextNodeMap: index.nodeMap
  })

  return index.groups.filter((group) => touchedGroupIds.has(group.id))
}

const createGroupUpdate = ({
  index,
  group,
  nodeSize,
  groupPadding
}: {
  index: NodeIndex
  group: Node
  nodeSize: { width: number; height: number }
  groupPadding: number
}): GroupUpdate | null => {
  const children = index.childrenByParentId.get(group.id) ?? []
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

const toWriteInput = (updates: readonly GroupUpdate[]): WriteInput | null => {
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

const createEmptyChange = (rebuild: Rebuild = 'none'): Change => ({
  rebuild,
  nodeIds: new Set<NodeId>()
})

export class Autofit {
  private readonly instance: AutofitOptions['instance']
  private prevNodeMap: ReadonlyMap<NodeId, Node> | null = null
  private layoutSnapshot: LayoutSnapshot | null = null
  private lastDocId: string | undefined
  private pending: Change = createEmptyChange()

  constructor({ instance }: AutofitOptions) {
    this.instance = instance
  }

  seed = (): boolean => this.promoteFull()

  ingest = (impact: ReadImpact): boolean => {
    const needsFull = (
      impact.reset ||
      impact.node.list ||
      impact.mindmap.view ||
      (impact.node.geometry && impact.node.ids.length === 0)
    )
    if (needsFull) {
      return this.promoteFull()
    }
    if (!impact.node.geometry || impact.node.ids.length === 0) return false
    return this.promoteDirty(impact.node.ids)
  }

  flush = (): WriteInput | null => {
    const pending = this.takePending()
    if (pending.rebuild === 'none') return null

    const doc = this.instance.document.get()
    const nodeSize = this.instance.config.nodeSize
    const groupPadding = this.instance.config.node.groupPadding
    const nextLayout = createLayoutSnapshot(nodeSize, groupPadding)
    const change = this.resolveChange(doc.id, nextLayout, pending)
    const index = createNodeIndex(listNodes(doc))
    const groups = selectGroups({
      change,
      prevNodeMap: this.prevNodeMap,
      index
    })
    const updates = groups
      .map((group) => createGroupUpdate({
        index,
        group,
        nodeSize,
        groupPadding
      }))
      .filter((update): update is GroupUpdate => update !== null)

    this.prevNodeMap = index.nodeMap
    this.layoutSnapshot = nextLayout

    return toWriteInput(updates)
  }

  private resolveChange = (
    docId: string,
    nextLayout: LayoutSnapshot,
    pending: Change
  ): Change => {
    const docChanged = this.syncDocument(docId)
    const layoutChanged = hasLayoutChanged(this.layoutSnapshot, nextLayout)
    if (docChanged || layoutChanged) {
      return createEmptyChange('full')
    }
    return pending
  }

  private syncDocument = (docId: string): boolean => {
    const docChanged = docId !== this.lastDocId
    if (!docChanged) return false
    this.prevNodeMap = null
    this.layoutSnapshot = null
    this.lastDocId = docId
    return true
  }

  private promoteFull = (): boolean => {
    if (this.pending.rebuild === 'full') return false
    this.pending = createEmptyChange('full')
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

  private takePending = (): Change => {
    const pending = this.pending
    this.pending = createEmptyChange()
    return pending
  }
}
