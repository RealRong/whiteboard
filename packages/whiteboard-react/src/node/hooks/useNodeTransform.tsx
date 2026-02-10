import { useCallback, useMemo, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { Core, Point, Rect } from '@whiteboard/core'
import type { Size } from 'types/common'
import type { ResizeDirection, TransformHandle, UseNodeTransformOptions } from 'types/node'
import { getNodeRect, getRectCenter } from '../../common/utils/geometry'
import { useInstance, useWhiteboardConfig } from '../../common/hooks'
import { useSnapRuntime } from './useSnapRuntime'
import { computeResizeSnap } from '../utils/snap'
import {
  buildTransformHandles,
  computeNextRotation,
  computeResizeRect,
  getResizeSourceEdges
} from '../utils/transform'


type DragState =
  | {
      mode: 'resize'
      pointerId: number
      handle: ResizeDirection
      startScreen: Point
      startCenter: Point
      startRotation: number
      startSize: Size
      startAspect: number
    }
  | {
      mode: 'rotate'
      pointerId: number
      startAngle: number
      startRotation: number
      center: Point
    }

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
  const { nodeSize } = useWhiteboardConfig()
  const snap = useSnapRuntime()
  const resolvedActiveTool = activeTool ?? 'select'
  const resolvedEnabled = enabled ?? (resolvedActiveTool === 'select' && Boolean(selected))
  const clientToScreen = instance.runtime.viewport.clientToScreen
  const screenToWorld = instance.runtime.viewport.screenToWorld
  const getZoom = instance.runtime.viewport.getZoom
  const core: Core = instance.runtime.core
  const dragRef = useRef<DragState | null>(null)

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
        const startRect = rect
        const startCenter = getRectCenter(startRect)
        const startRotation = rotation
        dragRef.current = {
          mode: 'resize',
          pointerId: event.pointerId,
          handle: handle.direction,
          startScreen: { x: event.clientX, y: event.clientY },
          startCenter,
          startRotation,
          startSize: { width: startRect.width, height: startRect.height },
          startAspect: startRect.width / Math.max(startRect.height, 0.0001)
        }
        return
      }
      if (handle.kind === 'rotate' && canRotate) {
        const worldPoint = screenToWorld(clientToScreen(event.clientX, event.clientY))
        const center = getRectCenter(rect)
        const startAngle = Math.atan2(worldPoint.y - center.y, worldPoint.x - center.x)
        dragRef.current = {
          mode: 'rotate',
          pointerId: event.pointerId,
          startAngle,
          startRotation: rotation,
          center
        }
      }
    },
    [canRotate, clientToScreen, node.locked, rect, resolvedEnabled, rotation, screenToWorld]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      if (drag.mode === 'resize') {
        const zoom = Math.max(getZoom(), 0.0001)
        const { handle, startScreen, startCenter, startRotation, startSize, startAspect } = drag
        const resizeResult = computeResizeRect({
          handle,
          startScreen,
          currentScreen: { x: event.clientX, y: event.clientY },
          startCenter,
          startRotation,
          startSize,
          startAspect,
          minSize,
          zoom,
          altKey: event.altKey,
          shiftKey: event.shiftKey
        })
        let width = resizeResult.width
        let height = resizeResult.height
        let nextRect = { x: resizeResult.rect.x, y: resizeResult.rect.y }
        if (snap?.enabled) {
          if (rotation === 0 && !event.altKey) {
            const thresholdWorld = snap.thresholdScreen / zoom
            const movingRect: Rect = {
              x: nextRect.x,
              y: nextRect.y,
              width,
              height
            }
            const queryRect: Rect = {
              x: movingRect.x - thresholdWorld,
              y: movingRect.y - thresholdWorld,
              width: movingRect.width + thresholdWorld * 2,
              height: movingRect.height + thresholdWorld * 2
            }
            const candidates = snap.getCandidates ? snap.getCandidates(queryRect) : snap.candidates
            const { sourceX, sourceY } = getResizeSourceEdges(handle)
            const snapped = computeResizeSnap({
              movingRect,
              candidates,
              threshold: thresholdWorld,
              minSize,
              excludeId: node.id,
              sourceEdges: { sourceX, sourceY }
            })
            width = snapped.width
            height = snapped.height
            nextRect = { x: snapped.rect.x, y: snapped.rect.y }
            snap.onGuidesChange?.(snapped.guides)
          } else {
            snap.onGuidesChange?.([])
          }
        }
        core.dispatch({
          type: 'node.update',
          id: node.id,
          patch: {
            position: { x: nextRect.x, y: nextRect.y },
            size: { width, height }
          }
        })
        return
      }
      if (drag.mode === 'rotate') {
        const worldPoint = screenToWorld(clientToScreen(event.clientX, event.clientY))
        const nextRotation = computeNextRotation({
          center: drag.center,
          currentPoint: worldPoint,
          startAngle: drag.startAngle,
          startRotation: drag.startRotation,
          shiftKey: event.shiftKey
        })
        core.dispatch({
          type: 'node.update',
          id: node.id,
          patch: {
            rotation: nextRotation
          }
        })
      }
    },
    [clientToScreen, core, getZoom, minSize.height, minSize.width, node.id, rotation, screenToWorld, snap]
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.currentTarget.releasePointerCapture(event.pointerId)
      snap?.onGuidesChange?.([])
      endDrag()
    },
    [endDrag, snap]
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
              cursor: handle.cursor,
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
