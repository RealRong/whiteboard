import type { Node } from '@whiteboard/core'
import { useMemo } from 'react'
import { useInstanceAtomValue } from '../../common/hooks'
import { canvasNodesAtom } from '../../common/state/whiteboardDerivedAtoms'
import { NodeItem } from './NodeItem'

export const NodeLayer = () => {
  const nodes = useInstanceAtomValue(canvasNodesAtom)
  const orderedNodes = useMemo(() => {
    const background: Node[] = []
    const normal: Node[] = []
    const overlay: Node[] = []
    nodes.forEach((node) => {
      const layer = node.layer ?? (node.type === 'group' ? 'background' : 'default')
      if (layer === 'background') {
        background.push(node)
        return
      }
      if (layer === 'overlay') {
        overlay.push(node)
        return
      }
      normal.push(node)
    })
    return [...background, ...normal, ...overlay]
  }, [nodes])
  return (
    <div className="wb-node-layer">
      {orderedNodes.map((node) => (
        <NodeItem key={node.id} node={node} />
      ))}
    </div>
  )
}
