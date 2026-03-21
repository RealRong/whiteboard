import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent
} from 'react'
import { RotateCw } from 'lucide-react'
import { buildTransformHandles, type TransformHandle } from '@whiteboard/core/node'
import type { NodeItem } from '@whiteboard/core/read'
import { useInternalInstance, useStoreValue } from '../../../runtime/hooks'

type NodeViewNode = NodeItem['node']
type NodeViewRect = NodeItem['rect']

type TransformHandlesProps = {
  rect: NodeViewRect
  rotation: number
  canResize: boolean
  canRotate: boolean
  onTransformPointerDown: (
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  handleProps?: Record<string, string | undefined>
}

type NodeTransformHandlesProps = {
  node: NodeViewNode
  rect: NodeViewRect
  rotation: number
  canResize: boolean
  canRotate: boolean
  onTransformPointerDown: (
    nodeId: NodeViewNode['id'],
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
}

const NODE_TRANSFORM_HANDLE_SIZE = 10
const NODE_ROTATE_HANDLE_SIZE = 22
const NODE_ROTATE_ICON_SIZE = 18
const NODE_ROTATE_HANDLE_OFFSET = 28

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

export const TransformHandles = ({
  rect,
  rotation,
  canResize,
  canRotate,
  onTransformPointerDown,
  handleProps
}: TransformHandlesProps) => {
  const instance = useInternalInstance()
  const zoom = useStoreValue(instance.viewport).zoom

  const handles = buildTransformHandles({
    rect,
    rotation,
    canResize,
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
          data-kind={handle.kind}
          data-transform-kind={handle.kind}
          data-resize-direction={handle.direction}
          className="wb-node-transform-handle"
          {...handleProps}
          onPointerDown={(event) => {
            onTransformPointerDown(handle, event)
          }}
          style={buildNodeTransformHandleStyle({
            handle,
            zoom,
            size: handle.kind === 'rotate'
              ? NODE_ROTATE_HANDLE_SIZE
              : NODE_TRANSFORM_HANDLE_SIZE
          })}
        >
          {handle.kind === 'rotate' ? (
            <RotateCw
              className="wb-node-transform-handle-icon"
              size={NODE_ROTATE_ICON_SIZE / Math.max(zoom, 0.0001)}
              strokeWidth={1}
              absoluteStrokeWidth
            />
          ) : null}
        </div>
      ))}
    </>
  )
}

export const NodeTransformHandles = ({
  node,
  rect,
  rotation,
  canResize,
  canRotate,
  onTransformPointerDown
}: NodeTransformHandlesProps) => (
  <TransformHandles
    rect={rect}
    rotation={rotation}
    canResize={canResize}
    canRotate={canRotate}
    handleProps={{
      'data-node-id': node.id
    }}
    onTransformPointerDown={(handle, event) => {
      onTransformPointerDown(node.id, handle, event)
    }}
  />
)
