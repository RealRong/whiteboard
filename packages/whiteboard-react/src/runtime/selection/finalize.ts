import type { NodeId } from '@whiteboard/core/types'
import type { BoardInstance } from '../instance'
import {
  createState as createContainerState,
  hasEdge
} from '../container'
import type { Store } from './state'

const uniqueNodeIds = (nodeIds: readonly NodeId[]) => {
  const seen = new Set<NodeId>()
  const next: NodeId[] = []

  nodeIds.forEach((nodeId) => {
    if (seen.has(nodeId)) {
      return
    }
    seen.add(nodeId)
    next.push(nodeId)
  })

  return next
}

const isOrderedEqual = (
  left: readonly NodeId[],
  right: readonly NodeId[]
) => (
  left.length === right.length
  && left.every((value, index) => value === right[index])
)

export const finalize = ({
  read,
  container,
  selection
}: {
  read: Pick<BoardInstance['read'], 'node' | 'edge'>
  container: ReturnType<typeof createContainerState>
  selection: Store
}) => {
  const activeContainerId = container.source.get()
  if (activeContainerId && !read.node.item.get(activeContainerId)) {
    container.commands.clear()
  }

  const activeContainer = container.store.get()
  const current = selection.source.get()

  if (current.kind === 'edge') {
    const edge = read.edge.item.get(current.edgeId)?.edge
    if (!edge || (activeContainer.id && !hasEdge(activeContainer, edge))) {
      selection.commands.clear()
    }
    return
  }

  if (current.kind !== 'nodes') {
    return
  }

  const nextNodeIds = uniqueNodeIds(current.nodeIds.filter((nodeId) => {
    if (!read.node.item.get(nodeId)) {
      return false
    }
    return activeContainer.id
      ? Boolean(activeContainer.set?.has(nodeId))
      : true
  }))

  if (isOrderedEqual(nextNodeIds, current.nodeIds)) {
    return
  }

  if (nextNodeIds.length > 0) {
    selection.commands.nodes(nextNodeIds, 'replace')
    return
  }

  selection.commands.clear()
}
