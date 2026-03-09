import type { NodeId } from '@whiteboard/core/types'
import { useNode, useNodeIds } from '../../common/hooks'
import { NodeItem } from './NodeItem'

const useNodeItem = (nodeId: NodeId) => useNode(nodeId)

const NodeItemById = ({ nodeId }: { nodeId: NodeId }) => {
  const item = useNodeItem(nodeId)

  if (!item) return null
  return <NodeItem item={item} />
}

export const NodeLayer = () => {
  const nodeIds = useNodeIds()

  return (
    <div className="wb-node-layer">
      {nodeIds.map((nodeId) => (
        <NodeItemById key={nodeId} nodeId={nodeId} />
      ))}
    </div>
  )
}
