import type { NodeId } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import { useInstance, useReadAtom } from '../../common/hooks'
import { NodeItem } from './NodeItem'

const useNodeItem = (nodeId: NodeId) => {
  const instance = useInstance()
  return useReadAtom<NodeViewItem | undefined>(instance.read.atoms.nodeById(nodeId))
}

const NodeItemById = ({ nodeId }: { nodeId: NodeId }) => {
  const item = useNodeItem(nodeId)

  if (!item) return null
  return <NodeItem item={item} />
}

export const NodeLayer = () => {
  const instance = useInstance()
  const nodeIds = useReadAtom(instance.read.atoms.nodeIds)

  return (
    <div className="wb-node-layer">
      {nodeIds.map((nodeId) => (
        <NodeItemById key={nodeId} nodeId={nodeId} />
      ))}
    </div>
  )
}
