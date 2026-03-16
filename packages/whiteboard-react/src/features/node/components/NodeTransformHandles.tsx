import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent
} from 'react'
import { buildTransformHandles, type TransformHandle } from '@whiteboard/core/node'
import type { NodeItem } from '@whiteboard/core/read'
import { useViewportZoom } from '../../../runtime/hooks'

type NodeViewNode = NodeItem['node']
type NodeViewRect = NodeItem['rect']

type NodeTransformHandlesProps = {
  node: NodeViewNode
  rect: NodeViewRect
  rotation: number
  canRotate: boolean
  onTransformPointerDown: (
    nodeId: NodeViewNode['id'],
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
}

const NODE_TRANSFORM_HANDLE_SIZE = 10
const NODE_ROTATE_HANDLE_OFFSET = 24

const buildNodeTransformHandleStyle = ({
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

export const NodeTransformHandles = ({
  node,
  rect,
  rotation,
  canRotate,
  onTransformPointerDown
}: NodeTransformHandlesProps) => {
  const zoom = useViewportZoom()

  const handles = buildTransformHandles({
    rect,
    rotation,
    canRotate,
    rotateHandleOffset: NODE_ROTATE_HANDLE_OFFSET,
    zoom
  })

  return (
    <>
      {handles.map((handle) => (
        <div
          key={handle.id}
          data-selection-ignore
          data-input-role="node-transform-handle"
          data-node-id={node.id}
          data-transform-kind={handle.kind}
          data-resize-direction={handle.direction}
          className="wb-node-transform-handle"
          onPointerDown={(event) => {
            onTransformPointerDown(node.id, handle, event)
          }}
          style={buildNodeTransformHandleStyle({
            handle,
            zoom,
            size: NODE_TRANSFORM_HANDLE_SIZE
          })}
        />
      ))}
    </>
  )
}
