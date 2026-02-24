import type { NodeId } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import { useViewSelector } from '../../common/hooks'
import { NodeItem } from './NodeItem'

const isSameIdOrder = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const useNodeIds = () => {
  return useViewSelector((state) => state.nodes.ids, {
    equality: isSameIdOrder
  })
}

const useNodeItem = (nodeId: NodeId) => {
  return useViewSelector<NodeViewItem | undefined>(
    (state) => state.nodes.byId.get(nodeId)
  )
}

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
