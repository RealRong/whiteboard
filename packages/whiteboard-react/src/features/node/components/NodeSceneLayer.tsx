import { useMemo } from 'react'
import {
  useInternalInstance,
  useSelection,
  useStoreValue
} from '../../../runtime/hooks'
import { useNodeSizeObserver } from '../hooks/useNodeSizeObserver'
import type { NodeGesture } from '../gesture'
import { NodeItem } from './NodeItem'

export const NodeSceneLayer = ({
  gesture
}: {
  gesture: NodeGesture
}) => {
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
  const chrome = useStoreValue(instance.read.node.chrome)
  const selection = useSelection()
  const selectedSet = selection.target.nodeSet
  const registerMeasuredElement = useNodeSizeObserver()
  const contentNodeIds = useMemo(
    () => instance.read.node.filter(nodeIds, 'content'),
    [instance, nodeIds]
  )

  return (
    <div className="wb-node-layer">
      {contentNodeIds.map((nodeId) => (
        <NodeItem
          key={nodeId}
          nodeId={nodeId}
          registerMeasuredElement={registerMeasuredElement}
          selected={selectedSet.has(nodeId) && chrome.selection}
          onNodePointerDown={gesture.handleNodePointerDown}
          onNodeDoubleClick={gesture.handleNodeDoubleClick}
        />
      ))}
    </div>
  )
}
