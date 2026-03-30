import { isContainerNode } from '@whiteboard/core/node'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import {
  isEdgeInFrameScope,
  isNodeInFrameScope
} from '@whiteboard/core/document'
import type { Editor } from '../../types/public/editor'
import type { FrameState } from '../frame'
import type { EditState } from '../edit'
import type { SelectionStore } from '../selection/store'

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
  frame,
  selection,
  edit
}: {
  read: Pick<Editor['read'], 'node' | 'edge'>
  frame: FrameState
  selection: SelectionStore
  edit: EditState
}) => {
  const activeFrameId = frame.source.get()
  if (activeFrameId) {
    const activeNode = read.node.item.get(activeFrameId)?.node
    if (!activeNode || !isContainerNode(activeNode)) {
      frame.commands.clear()
    }
  }

  const activeFrame = frame.store.get()
  const currentSelection = selection.source.get()
  const nextNodeIds = uniqueNodeIds(currentSelection.nodeIds.filter((nodeId) => {
    if (!read.node.item.get(nodeId)) {
      return false
    }
    return activeFrame.id
      ? Boolean(activeFrame.set?.has(nodeId))
      : true
  }))
  const nextEdgeIds = uniqueEdgeIds(currentSelection.edgeIds.filter((edgeId) => {
    const edge = read.edge.item.get(edgeId)?.edge
    if (!edge) {
      return false
    }
    return activeFrame.id
      ? isEdgeInFrameScope(activeFrame, edge)
      : true
  }))

  if (
    !isOrderedEqual(nextNodeIds, currentSelection.nodeIds)
    || !isOrderedEdgeEqual(nextEdgeIds, currentSelection.edgeIds)
  ) {
    if (nextNodeIds.length > 0 || nextEdgeIds.length > 0) {
      selection.commands.replace({
        nodeIds: nextNodeIds,
        edgeIds: nextEdgeIds
      })
    } else {
      selection.commands.clear()
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

  if (activeFrame.id && !isNodeInFrameScope(activeFrame, currentEdit.nodeId)) {
    edit.commands.clear()
  }
}
