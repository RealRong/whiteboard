import type { Node } from '@whiteboard/core'
import { useMemo } from 'react'
import { useViewGraph } from '../../common/hooks'
import { NodeItem } from './NodeItem'

export const NodeLayer = () => {
  const viewGraph = useViewGraph()
  const nodes = viewGraph.canvasNodes
  const orderedNodes = useMemo(() => {
    const groups: Node[] = []
    const rest: Node[] = []
    nodes.forEach((node) => {
      if (node.type === 'group') {
        groups.push(node)
      } else {
        rest.push(node)
      }
    })
    return [...groups, ...rest]
  }, [nodes])
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {orderedNodes.map((node) => (
        <NodeItem key={node.id} node={node} />
      ))}
    </div>
  )
}
