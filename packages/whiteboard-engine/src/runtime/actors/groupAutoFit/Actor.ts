import type { Node } from '@whiteboard/core/types'
import type { Size } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Scheduler } from '../../Scheduler'
import { MicrotaskTask } from '../../TaskQueue'
import { DEFAULT_TUNING } from '../../../config'
import { getNodeAABB } from '@whiteboard/core/geometry'
import {
  expandGroupRect,
  getGroupDescendants,
  getNodesBoundingRect,
  rectEquals
} from '../../../domains/node/model'

type Snapshot = {
  nodeMap: Map<string, Node>
  signatureMap: Map<string, string>
}

type LayoutSnapshot = {
  width: number
  height: number
  padding: number
}

type ActorOptions = {
  instance: Pick<InternalInstance, 'document' | 'config' | 'mutate' | 'events'>
  scheduler: Scheduler
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
  mutate,
  nodes,
  group,
  nodeSize,
  defaultPadding
}: {
  mutate: ActorOptions['instance']['mutate']
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
  if (rectEquals(expanded, groupRect, DEFAULT_TUNING.group.rectEpsilon)) return

  void mutate(
    [{
      type: 'node.update',
      id: group.id,
      patch: {
        position: { x: expanded.x, y: expanded.y },
        size: { width: expanded.width, height: expanded.height }
      }
    }],
    'system'
  )
}

export class Actor {
  readonly name = 'GroupAutoFit'

  private readonly instance: ActorOptions['instance']
  private snapshot: Snapshot | null = null
  private layoutSnapshot: LayoutSnapshot | null = null
  private lastDocId: string | undefined
  private started = false
  private offDocChanged: (() => void) | null = null
  private readonly syncTask: MicrotaskTask

  constructor({ instance, scheduler }: ActorOptions) {
    this.instance = instance
    this.syncTask = new MicrotaskTask(scheduler, this.triggerSync)
  }

  private runSync = () => {
    const doc = this.instance.document.get()
    const docId = doc.id
    const nodes = doc.nodes
    const nodeSize = this.instance.config.nodeSize
    const padding = this.instance.config.node.groupPadding

    if (docId !== this.lastDocId) {
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
      applyGroupAutoFit({
        mutate: this.instance.mutate,
        nodes,
        group,
        nodeSize,
        defaultPadding: padding
      })
    })

    this.snapshot = currentSnapshot
    this.layoutSnapshot = nextLayout
  }

  private triggerSync = () => {
    if (!this.started) return
    this.runSync()
  }

  private scheduleSync = () => {
    if (!this.started) return
    this.syncTask.schedule()
  }

  stop = () => {
    if (!this.started) return
    this.started = false
    this.offDocChanged?.()
    this.offDocChanged = null
    this.syncTask.cancel()
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.offDocChanged = this.instance.events.on('doc.changed', ({ operationTypes }) => {
      this.handleMutations(operationTypes)
    })
    this.scheduleSync()
  }

  private handleMutations = (operationTypes: string[]) => {
    const hasNodeOperation = operationTypes.some((type) => type.startsWith('node.'))
    const hasRelevantChange = hasNodeOperation || operationTypes.includes('doc.reset')
    if (!hasRelevantChange) return
    this.scheduleSync()
  }
}
