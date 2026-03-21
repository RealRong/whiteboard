import type { NodeId } from '@whiteboard/core/types'
import type { WhiteboardInstance } from './instance'
import {
  createState as createContainerState,
  hasEdge,
  hasNode
} from './container'
import type { State as EditState } from './edit'
import type { Store as SelectionStore } from './selection'

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
  selection,
  edit
}: {
  read: Pick<WhiteboardInstance['read'], 'node' | 'edge'>
  container: ReturnType<typeof createContainerState>
  selection: SelectionStore
  edit: EditState
}) => {
  const activeContainerId = container.source.get()
  if (activeContainerId && !read.node.item.get(activeContainerId)) {
    container.commands.clear()
  }

  const activeContainer = container.store.get()
  const currentSelection = selection.source.get()

  if (currentSelection.kind === 'edge') {
    const edge = read.edge.item.get(currentSelection.edgeId)?.edge
    if (!edge || (activeContainer.id && !hasEdge(activeContainer, edge))) {
      selection.commands.clear()
    }
  } else if (currentSelection.kind === 'nodes') {
    const nextNodeIds = uniqueNodeIds(currentSelection.nodeIds.filter((nodeId) => {
      if (!read.node.item.get(nodeId)) {
        return false
      }
      return activeContainer.id
        ? Boolean(activeContainer.set?.has(nodeId))
        : true
    }))

    if (!isOrderedEqual(nextNodeIds, currentSelection.nodeIds)) {
      if (nextNodeIds.length > 0) {
        selection.commands.replace(nextNodeIds)
      } else {
        selection.commands.clear()
      }
    }
  }

  const currentEdit = edit.store.get()
  if (!currentEdit) {
    return
  }

  if (!read.node.item.get(currentEdit.nodeId)) {
    edit.commands.clear()
    return
  }

  if (activeContainer.id && !hasNode(activeContainer, currentEdit.nodeId)) {
    edit.commands.clear()
  }
}
