import type { NodeId } from '@whiteboard/core/types'
import {
  READ_SUBSCRIBE_KEYS,
  type NodeViewItem
} from '@whiteboard/engine'
import { useInstance, useReadGetter } from '../../common/hooks'
import { NodeItem } from './NodeItem'

const useNodeItem = (nodeId: NodeId) => {
  const instance = useInstance()
  return useReadGetter<NodeViewItem | undefined>(
    () => instance.read.get.nodeById(nodeId),
    { keys: [READ_SUBSCRIBE_KEYS.snapshot] }
  )
}

const NodeItemById = ({ nodeId }: { nodeId: NodeId }) => {
  const item = useNodeItem(nodeId)

  if (!item) return null
  return <NodeItem item={item} />
}

export const NodeLayer = () => {
  const instance = useInstance()
  const nodeIds = useReadGetter(
    () => instance.read.get.nodeIds(),
    { keys: [READ_SUBSCRIBE_KEYS.snapshot] }
  )

  return (
    <div className="wb-node-layer">
      {nodeIds.map((nodeId) => (
        <NodeItemById key={nodeId} nodeId={nodeId} />
      ))}
    </div>
  )
}
