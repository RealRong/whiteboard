import type { NodeId } from '@whiteboard/core/types'
import {
  READ_KEYS,
  type NodeViewItem
} from '@whiteboard/engine'
import { useInstance, useReadGetter } from '../../common/hooks'
import { NodeItem } from './NodeItem'

const useNodeItem = (nodeId: NodeId) => {
  const instance = useInstance()
  return useReadGetter<NodeViewItem | undefined>(
    () => instance.read.node.byId.get(nodeId),
    { key: READ_KEYS.node }
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
    () => instance.read.node.ids,
    { key: READ_KEYS.node }
  )

  return (
    <div className="wb-node-layer">
      {nodeIds.map((nodeId) => (
        <NodeItemById key={nodeId} nodeId={nodeId} />
      ))}
    </div>
  )
}
