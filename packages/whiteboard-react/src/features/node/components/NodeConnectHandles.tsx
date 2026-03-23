import { getNodeAnchorPoint } from '@whiteboard/core/node'
import type { NodeItem } from '@whiteboard/core/read'
import type { EdgeAnchor } from '@whiteboard/core/types'

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
  const localRect = {
    x: 0,
    y: 0,
    width: rect.width,
    height: rect.height
  }
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
      {NODE_CONNECT_SIDES.map((side) => {
        const point = getNodeAnchorPoint(
          node,
          localRect,
          {
            side: side as EdgeAnchor['side'],
            offset: 0.5
          },
          0
        )

        return (
          <div
            key={side}
            data-selection-ignore
            data-input-role="node-edge-handle"
            data-node-id={node.id}
            data-handle-side={side}
            className="wb-node-handle"
            style={{
              left: `calc(${point.x}px - (12px / var(--wb-zoom, 1) / 2))`,
              top: `calc(${point.y}px - (12px / var(--wb-zoom, 1) / 2))`,
              marginLeft: 0,
              marginTop: 0,
              right: 'auto',
              bottom: 'auto'
            }}
          />
        )
      })}
    </div>
  )
}
