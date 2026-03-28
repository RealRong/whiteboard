import { useMemo } from 'react'
import {
  useEditor,
  useStoreValue
} from '../../../runtime/hooks'
import { useNodeSizeObserver } from '../hooks/useNodeSizeObserver'
import { useSelection } from '../selection'
import { NodeItem } from './NodeItem'

export const NodeSceneLayer = () => {
  const editor = useEditor()
  const nodeIds = useStoreValue(editor.read.node.list)
  const selection = useSelection()
  const selectedSet = selection.target.nodeSet
  const registerMeasuredElement = useNodeSizeObserver()
  const contentNodeIds = useMemo(
    () => editor.read.node.filter(nodeIds, 'content'),
    [editor, nodeIds]
  )

  return (
    <div className="wb-node-layer">
      {contentNodeIds.map((nodeId) => (
        <NodeItem
          key={nodeId}
          nodeId={nodeId}
          registerMeasuredElement={registerMeasuredElement}
          selected={selectedSet.has(nodeId)}
        />
      ))}
    </div>
  )
}
