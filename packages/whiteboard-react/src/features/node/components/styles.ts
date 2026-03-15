import type { CSSProperties } from 'react'
import type { TransformHandle } from '@whiteboard/core/node'
import type { NodeViewItem } from '@whiteboard/core/read'

type NodeViewRect = NodeViewItem['rect']

export const buildNodeTransformHandleStyle = ({
  handle,
  zoom,
  size
}: {
  handle: TransformHandle
  zoom: number
  size: number
}): CSSProperties => {
  const half = size / Math.max(zoom, 0.0001) / 2

  return {
    '--wb-node-handle-size': `${size}px`,
    '--wb-node-handle-x': `${handle.position.x - half}px`,
    '--wb-node-handle-y': `${handle.position.y - half}px`,
    cursor: handle.cursor
  } as CSSProperties
}

export const buildNodeTransformStyle = (
  rect: NodeViewRect,
  rotation: number,
  nodeStyle: CSSProperties
): CSSProperties => {
  const extraTransform = nodeStyle.transform
  const baseTransform = `translate(${rect.x}px, ${rect.y}px)`
  const rotationTransform = rotation !== 0 ? `rotate(${rotation}deg)` : undefined
  const transform = [baseTransform, extraTransform, rotationTransform]
    .filter(Boolean)
    .join(' ')

  return {
    transform: transform || undefined,
    transformOrigin: rotationTransform ? 'center center' : nodeStyle.transformOrigin
  }
}

export const buildNodeContainerStyle = (
  nodeStyle: CSSProperties,
  transformStyle: CSSProperties
): CSSProperties => ({
  ...nodeStyle,
  pointerEvents: 'auto',
  ...transformStyle
})

export const buildNodeConnectHandleOverlayStyle = (
  transformStyle: CSSProperties
): CSSProperties => ({
  position: 'absolute',
  left: 0,
  top: 0,
  pointerEvents: 'none',
  ...transformStyle
})
