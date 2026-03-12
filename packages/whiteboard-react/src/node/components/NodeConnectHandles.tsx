import type { CSSProperties } from 'react'
import type { NodeViewItem } from '@whiteboard/engine'

type NodeViewNode = NodeViewItem['node']
type NodeViewRect = NodeViewItem['rect']

type NodeConnectHandlesProps = {
  node: NodeViewNode
  rect: NodeViewRect
  style: CSSProperties
}

const NODE_CONNECT_SIDES = ['top', 'right', 'bottom', 'left'] as const

export const NodeConnectHandles = ({
  node,
  rect,
  style
}: NodeConnectHandlesProps) => {
  return (
    <div
      className="wb-node-connect-handle-layer"
      style={{
        ...style,
        width: rect.width,
        height: rect.height
      }}
    >
      {NODE_CONNECT_SIDES.map((side) => (
        <div
          key={side}
          data-selection-ignore
          data-input-role="node-edge-handle"
          data-node-id={node.id}
          data-handle-side={side}
          className={`wb-node-handle wb-node-handle-${side}`}
        />
      ))}
    </div>
  )
}
