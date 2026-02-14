import { useCallback, useMemo, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { NodeTransformDragState } from '@whiteboard/engine'
import type { TransformHandle, UseNodeTransformOptions } from 'types/node'
import { getNodeRect } from '../../common/utils/geometry'
import { useInstance } from '../../common/hooks'
import { buildTransformHandles } from '../utils/transform'

export const useNodeTransform = ({
  node,
  enabled,
  selected,
  activeTool,
  canRotate = true,
  minSize = { width: 20, height: 20 },
  handleSize = 10,
  rotateHandleOffset = 24
}: UseNodeTransformOptions) => {
  const instance = useInstance()
  const { nodeSize } = instance.runtime.config
  const getZoom = instance.runtime.viewport.getZoom
  const nodeTransform = instance.runtime.services.nodeTransform
  const dragRef = useRef<NodeTransformDragState | null>(null)

  const resolvedActiveTool = activeTool ?? 'select'
  const resolvedEnabled = enabled ?? (resolvedActiveTool === 'select' && Boolean(selected))
  const rect = useMemo(() => getNodeRect(node, nodeSize), [node, nodeSize])
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0

  const handles = useMemo<TransformHandle[]>(() => {
    if (!resolvedEnabled || node.locked) return []
    return buildTransformHandles({
      rect,
      rotation,
      canRotate,
      rotateHandleOffset,
      zoom: getZoom()
    })
  }, [canRotate, getZoom, node.locked, rect, resolvedEnabled, rotation, rotateHandleOffset])

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  const handlePointerDown = useCallback(
    (handle: TransformHandle, event: ReactPointerEvent<HTMLElement>) => {
      if (!resolvedEnabled || node.locked) return
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      if (handle.kind === 'resize' && handle.direction) {
        dragRef.current = nodeTransform.createResizeDrag({
          pointerId: event.pointerId,
          handle: handle.direction,
          clientX: event.clientX,
          clientY: event.clientY,
          rect,
          rotation
        })
        return
      }

      if (handle.kind === 'rotate' && canRotate) {
        dragRef.current = nodeTransform.createRotateDrag({
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          rect,
          rotation
        })
      }
    },
    [canRotate, node.locked, nodeTransform, rect, resolvedEnabled, rotation]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      event.preventDefault()

      if (drag.mode === 'resize') {
        nodeTransform.applyResizeMove({
          nodeId: node.id,
          drag,
          clientX: event.clientX,
          clientY: event.clientY,
          minSize,
          altKey: event.altKey,
          shiftKey: event.shiftKey
        })
        return
      }

      if (drag.mode === 'rotate') {
        nodeTransform.applyRotateMove({
          nodeId: node.id,
          drag,
          clientX: event.clientX,
          clientY: event.clientY,
          shiftKey: event.shiftKey
        })
      }
    },
    [minSize, node.id, nodeTransform]
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      event.currentTarget.releasePointerCapture(event.pointerId)

      if (drag.mode === 'resize') {
        nodeTransform.finishResize({ nodeId: node.id, drag })
      } else {
        nodeTransform.clear()
      }

      endDrag()
    },
    [endDrag, node.id, nodeTransform]
  )

  const getHandleProps = useCallback(
    (handle: TransformHandle) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => handlePointerDown(handle, event),
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp]
  )

  const renderHandles = useCallback(
    (options?: { renderHandle?: (handle: TransformHandle, props: ReturnType<typeof getHandleProps>) => ReactNode }) => {
      if (!handles.length) return null
      return handles.map((handle) => {
        const props = getHandleProps(handle)
        if (options?.renderHandle) {
          return options.renderHandle(handle, props)
        }
        const half = handleSize / Math.max(getZoom(), 0.0001) / 2
        return (
          <div
            key={handle.id}
            data-selection-ignore
            data-kind={handle.kind}
            className="wb-node-transform-handle"
            style={{
              '--wb-node-handle-size': `${handleSize}px`,
              '--wb-node-handle-x': `${handle.position.x - half}px`,
              '--wb-node-handle-y': `${handle.position.y - half}px`,
              cursor: handle.cursor
            } as CSSProperties}
            {...props}
          />
        )
      })
    },
    [getHandleProps, getZoom, handleSize, handles]
  )

  return {
    handles,
    getHandleProps,
    renderHandles
  }
}
