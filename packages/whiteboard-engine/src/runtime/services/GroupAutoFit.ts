import type { Core, Node } from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import type { GroupAutoFit as GroupAutoFitApi } from '@engine-types/instance/services'
import { getNodeAABB } from '../../infra/geometry'
import { expandGroupRect, getGroupDescendants, getNodesBoundingRect, rectEquals } from '../../node/utils/group'

type Snapshot = {
  nodeMap: Map<string, Node>
  signatureMap: Map<string, string>
}

type LayoutSnapshot = {
  width: number
  height: number
  padding: number
}

const createNodeSignature = (node: Node) => {
  const autoFit = node.data && typeof node.data.autoFit === 'string' ? node.data.autoFit : ''
  const groupPadding = node.data && typeof node.data.padding === 'number' ? node.data.padding : ''
  const width = node.size?.width ?? ''
  const height = node.size?.height ?? ''
  const rotation = typeof node.rotation === 'number' ? node.rotation : ''
  return [
    node.type,
    node.parentId ?? '',
    node.position.x,
    node.position.y,
    width,
    height,
    rotation,
    autoFit,
    groupPadding
  ].join('|')
}

const createSnapshot = (nodes: Node[]): Snapshot => {
  const nodeMap = new Map<string, Node>()
  const signatureMap = new Map<string, string>()
  nodes.forEach((node) => {
    nodeMap.set(node.id, node)
    signatureMap.set(node.id, createNodeSignature(node))
  })
  return { nodeMap, signatureMap }
}

const collectChangedNodeIds = (prev: Snapshot, next: Snapshot): Set<string> => {
  const changedIds = new Set<string>()
  const allIds = new Set<string>()
  prev.signatureMap.forEach((_value, id) => allIds.add(id))
  next.signatureMap.forEach((_value, id) => allIds.add(id))

  allIds.forEach((id) => {
    if (prev.signatureMap.get(id) !== next.signatureMap.get(id)) {
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
      if (prevNode.parentId) {
        addGroupAncestors(prevNode.parentId, prev.nodeMap, dirtyGroupIds)
      }
    }

    if (nextNode) {
      addGroupAncestors(nextNode.id, next.nodeMap, dirtyGroupIds)
      if (nextNode.parentId) {
        addGroupAncestors(nextNode.parentId, next.nodeMap, dirtyGroupIds)
      }
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
  nodes,
  prevSnapshot,
  currentSnapshot,
  layoutChanged
}: {
  nodes: Node[]
  prevSnapshot: Snapshot | null
  currentSnapshot: Snapshot
  layoutChanged: boolean
}): Node[] => {
  if (!nodes.length) return []
  if (!prevSnapshot || layoutChanged) {
    return nodes.filter((node) => node.type === 'group')
  }

  const changedNodeIds = collectChangedNodeIds(prevSnapshot, currentSnapshot)
  if (!changedNodeIds.size) return []

  const dirtyGroupIds = collectDirtyGroupIds(changedNodeIds, prevSnapshot, currentSnapshot)
  if (!dirtyGroupIds.size) return []

  return nodes.filter((node) => node.type === 'group' && dirtyGroupIds.has(node.id))
}

const applyGroupAutoFit = ({
  core,
  nodes,
  group,
  nodeSize,
  defaultPadding
}: {
  core: Core
  nodes: Node[]
  group: Node
  nodeSize: Size
  defaultPadding: number
}) => {
  const autoFit = group.data && typeof group.data.autoFit === 'string' ? group.data.autoFit : 'expand-only'
  if (autoFit === 'manual') return

  const groupPadding = group.data && typeof group.data.padding === 'number' ? group.data.padding : defaultPadding
  const children = getGroupDescendants(nodes, group.id)
  if (!children.length) return

  const contentRect = getNodesBoundingRect(children, nodeSize)
  if (!contentRect) return

  const groupRect = getNodeAABB(group, nodeSize)
  const expanded = expandGroupRect(groupRect, contentRect, groupPadding)
  if (rectEquals(expanded, groupRect)) return

  void core.dispatch(
    {
      type: 'node.update',
      id: group.id,
      patch: {
        position: { x: expanded.x, y: expanded.y },
        size: { width: expanded.width, height: expanded.height }
      }
    },
    { origin: 'system' }
  )
}

export class GroupAutoFit implements GroupAutoFitApi {
  private core: Core
  private snapshot: Snapshot | null = null
  private layoutSnapshot: LayoutSnapshot | null = null
  private lastDocId: string | undefined
  private stopBinding: (() => void) | null = null
  private pendingSync = false
  private scheduleVersion = 0
  private activeOptions: Parameters<GroupAutoFitApi['start']>[0] | null = null

  constructor(core: Core) {
    this.core = core
  }

  private scheduleMicrotask = (callback: () => void) => {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(callback)
      return
    }
    void Promise.resolve().then(callback)
  }

  reset: GroupAutoFitApi['reset'] = () => {
    this.snapshot = null
    this.layoutSnapshot = null
    this.lastDocId = undefined
  }

  sync: GroupAutoFitApi['sync'] = ({ docId, nodes, nodeSize, padding = 24 }) => {
    if (docId !== undefined && docId !== this.lastDocId) {
      this.snapshot = null
      this.layoutSnapshot = null
      this.lastDocId = docId
    }

    const currentSnapshot = createSnapshot(nodes)
    const nextLayout = toLayoutSnapshot(nodeSize, padding)
    const groupsToProcess = resolveGroupsToProcess({
      nodes,
      prevSnapshot: this.snapshot,
      currentSnapshot,
      layoutChanged: isLayoutChanged(this.layoutSnapshot, nodeSize, padding)
    })

    groupsToProcess.forEach((group) => {
      applyGroupAutoFit({ core: this.core, nodes, group, nodeSize, defaultPadding: padding })
    })

    this.snapshot = currentSnapshot
    this.layoutSnapshot = nextLayout
  }

  private triggerSync = () => {
    if (!this.activeOptions) return
    this.sync({
      docId: this.activeOptions.getDocId?.(),
      nodes: this.activeOptions.getNodes(),
      nodeSize: this.activeOptions.getNodeSize(),
      padding: this.activeOptions.getPadding?.()
    })
  }

  private scheduleSync = () => {
    if (this.pendingSync) return
    this.pendingSync = true
    const version = ++this.scheduleVersion
    this.scheduleMicrotask(() => {
      if (version !== this.scheduleVersion) return
      this.pendingSync = false
      this.triggerSync()
    })
  }

  stop: GroupAutoFitApi['stop'] = () => {
    this.stopBinding?.()
    this.stopBinding = null
    this.activeOptions = null
    this.pendingSync = false
    this.scheduleVersion += 1
  }

  start: GroupAutoFitApi['start'] = (options) => {
    this.stop()
    this.activeOptions = options

    const offAfter = this.core.changes.onAfter(({ changes }) => {
      const hasNodeChange = changes.operations.some((operation) => operation.type.startsWith('node.'))
      if (!hasNodeChange) return
      this.scheduleSync()
    })

    this.stopBinding = () => {
      offAfter()
    }

    this.scheduleSync()
    return this.stop
  }

  dispose: GroupAutoFitApi['dispose'] = () => {
    this.stop()
    this.reset()
  }
}
