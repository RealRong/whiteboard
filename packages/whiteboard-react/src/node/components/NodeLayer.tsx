import { useWhiteboardView } from '../../common/hooks'
import { NodeItem } from './NodeItem'

export const NodeLayer = () => {
  const orderedNodes = useWhiteboardView('node.items')
  const transformHandleMap = useWhiteboardView('node.transformHandles')

  return (
    <div className="wb-node-layer">
      {orderedNodes.map((node) => (
        <NodeItem key={node.node.id} item={node} transformHandles={transformHandleMap.get(node.node.id)} />
      ))}
    </div>
  )
}
