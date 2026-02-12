import { useCallback, useMemo, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { Core, Point, Rect } from '@whiteboard/core'
import type { Size } from 'types/common'
import type { ResizeDirection, TransformHandle, UseNodeTransformOptions } from 'types/node'
import { getNodeRect, getRectCenter } from '../../common/utils/geometry'
import { useInstance } from '../../common/hooks'
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
      lastUpdate?: {
        position: Point
        size: Size
      }
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
  const { nodeSize, node: nodeConfig } = instance.runtime.config
  const clientToWorld = instance.runtime.viewport.clientToWorld
  const getZoom = instance.runtime.viewport.getZoom
  const getSnapCandidatesInRect = instance.query.getSnapCandidatesInRect
  const readState = instance.state.read
  const setDragGuides = instance.commands.transient.dragGuides.set
  const clearDragGuides = instance.commands.transient.dragGuides.clear
  const setNodeOverrides = instance.commands.transient.nodeOverrides.set
  const commitNodeOverrides = instance.commands.transient.nodeOverrides.commit
  const core: Core = instance.runtime.core
  const dragRef = useRef<DragState | null>(null)

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
        const worldPoint = clientToWorld(event.clientX, event.clientY)
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
    [canRotate, clientToWorld, node.locked, rect, resolvedEnabled, rotation]
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

        if (readState('tool') === 'select') {
          if (rotation === 0 && !event.altKey) {
            const thresholdWorld = Math.min(nodeConfig.snapThresholdScreen / zoom, nodeConfig.snapMaxThresholdWorld)
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
            const candidates = getSnapCandidatesInRect(queryRect)
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
            setDragGuides(snapped.guides)
          } else {
            clearDragGuides()
          }
        }

        const update = {
          position: { x: nextRect.x, y: nextRect.y },
          size: { width, height }
        }

        drag.lastUpdate = update
        setNodeOverrides([{ id: node.id, ...update }])
        return
      }

      if (drag.mode === 'rotate') {
        const worldPoint = clientToWorld(event.clientX, event.clientY)
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
    [
      clearDragGuides,
      clientToWorld,
      core,
      getSnapCandidatesInRect,
      getZoom,
      minSize.height,
      minSize.width,
      node.id,
      nodeConfig.snapMaxThresholdWorld,
      nodeConfig.snapThresholdScreen,
      readState,
      rotation,
      setDragGuides,
      setNodeOverrides
    ]
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      event.currentTarget.releasePointerCapture(event.pointerId)

      if (drag.mode === 'resize' && drag.lastUpdate) {
        commitNodeOverrides([{ id: node.id, ...drag.lastUpdate }])
      }

      clearDragGuides()
      endDrag()
    },
    [clearDragGuides, commitNodeOverrides, endDrag, node.id]
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
