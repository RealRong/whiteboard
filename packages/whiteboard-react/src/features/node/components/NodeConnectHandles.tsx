import type { NodeItem } from '@whiteboard/core/read'

type NodeViewNode = NodeItem['node']
type NodeViewRect = NodeItem['rect']

type NodeConnectHandlesProps = {
  node: NodeViewNode
  rect: NodeViewRect
  rotation: number
}

const NODE_CONNECT_SIDES = ['top', 'right', 'bottom', 'left'] as const

export const NodeConnectHandles = ({
  node,
  rect,
  rotation
}: NodeConnectHandlesProps) => {
  const transform = [
    `translate(${rect.x}px, ${rect.y}px)`,
    rotation !== 0 ? `rotate(${rotation}deg)` : undefined
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className="wb-node-connect-handle-layer"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: rect.width,
        height: rect.height,
        pointerEvents: 'none',
        transform: transform || undefined,
        transformOrigin: rotation !== 0 ? 'center center' : undefined
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
