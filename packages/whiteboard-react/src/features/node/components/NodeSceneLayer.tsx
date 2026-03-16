import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { NodeId } from '@whiteboard/core/types'
import { useInternalInstance, useSelection, useStoreValue } from '../../../runtime/hooks'
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
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
  const selection = useSelection()
  const selectedSet = selection.target.nodeSet

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
