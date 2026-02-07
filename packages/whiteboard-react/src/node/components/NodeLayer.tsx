import type { Node } from '@whiteboard/core'
import { useMemo } from 'react'
import { useCanvasNodes } from '../../common/hooks'
import { NodeItem } from './NodeItem'

export const NodeLayer = () => {
  const nodes = useCanvasNodes()
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
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {orderedNodes.map((node) => (
        <NodeItem key={node.id} node={node} />
      ))}
    </div>
  )
}
