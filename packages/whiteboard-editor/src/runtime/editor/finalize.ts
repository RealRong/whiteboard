import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { Editor } from '../../types/editor'
import type { EditState } from '../state/edit'
import type { SelectionState } from '../state/selection'

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

const uniqueEdgeIds = (edgeIds: readonly EdgeId[]) => {
  const seen = new Set<EdgeId>()
  const next: EdgeId[] = []

  edgeIds.forEach((edgeId) => {
    if (seen.has(edgeId)) {
      return
    }
    seen.add(edgeId)
    next.push(edgeId)
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

const isOrderedEdgeEqual = (
  left: readonly EdgeId[],
  right: readonly EdgeId[]
) => (
  left.length === right.length
  && left.every((value, index) => value === right[index])
)

export const finalize = ({
  read,
  selection,
  edit
}: {
  read: Pick<Editor['read'], 'node' | 'edge'>
  selection: SelectionState
  edit: EditState
}) => {
  const currentSelection = selection.source.get()
  const nextNodeIds = uniqueNodeIds(currentSelection.nodeIds.filter((nodeId) =>
    Boolean(read.node.item.get(nodeId))
  ))
  const nextEdgeIds = uniqueEdgeIds(currentSelection.edgeIds.filter((edgeId) =>
    Boolean(read.edge.item.get(edgeId))
  ))

  if (
    !isOrderedEqual(nextNodeIds, currentSelection.nodeIds)
    || !isOrderedEdgeEqual(nextEdgeIds, currentSelection.edgeIds)
  ) {
    if (nextNodeIds.length > 0 || nextEdgeIds.length > 0) {
      selection.mutate.replace({
        nodeIds: nextNodeIds,
        edgeIds: nextEdgeIds
      })
    } else {
      selection.mutate.clear()
    }
  }

  const currentEdit = edit.source.get()
  if (!currentEdit) {
    return
  }

  if (!read.node.item.get(currentEdit.nodeId)) {
    edit.mutate.clear()
  }
}
