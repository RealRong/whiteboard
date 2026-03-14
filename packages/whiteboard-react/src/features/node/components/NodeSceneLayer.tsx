import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { NodeId } from '@whiteboard/core/types'
import { useNodeIds } from '../../../runtime/hooks'
import { useSelectionState } from '../../../runtime/view/selection'
import { NodeItem } from './NodeItem'

export const NodeSceneLayer = ({
  registerMeasuredElement,
  onNodePointerDown,
  onNodeDoubleClick
}: {
  registerMeasuredElement: (
    nodeId: NodeId,
    element: HTMLDivElement | null,
    enabled: boolean
  ) => void
  onNodePointerDown: (
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  onNodeDoubleClick: (
    nodeId: NodeId,
    event: ReactMouseEvent<HTMLDivElement>
  ) => void
}) => {
  const nodeIds = useNodeIds()
  const selection = useSelectionState()
  const selectedSet = selection.nodeIdSet

  return (
    <div className="wb-node-layer">
      {nodeIds.map((nodeId) => (
        <NodeItem
          key={nodeId}
          nodeId={nodeId}
          registerMeasuredElement={registerMeasuredElement}
          selected={selectedSet.has(nodeId)}
          onNodePointerDown={onNodePointerDown}
          onNodeDoubleClick={onNodeDoubleClick}
        />
      ))}
    </div>
  )
}
