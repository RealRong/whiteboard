import { useCallback, useMemo, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import type { Core, Node, Point, Rect } from '@whiteboard/core'
import type { Size } from '../../common/types'
import type { Guide, SnapCandidate } from '../utils/snap'
import { getNodeRect, getRectCenter, rotatePoint } from '../../common/utils/geometry'
import { useInstance, useWhiteboardConfig } from '../../common/hooks'
import { useSnapRuntime } from './useSnapRuntime'
import { nodeSelectionAtom, toolAtom } from '../../common/state'

type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
type HandleKind = 'resize' | 'rotate'

export type TransformHandle = {
  id: string
  kind: HandleKind
  direction?: ResizeDirection
  position: Point
  cursor: string
}

export type UseNodeTransformOptions = {
  node: Node
  enabled?: boolean
  canRotate?: boolean
  minSize?: Size
  handleSize?: number
  rotateHandleOffset?: number
}

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

type TransformState = {
  isResizing: boolean
  isRotating: boolean
  activeHandleId?: string
}

const resizeMap: Record<ResizeDirection, { sx: -1 | 0 | 1; sy: -1 | 0 | 1; cursor: string }> = {
  nw: { sx: -1, sy: -1, cursor: 'nwse-resize' },
  n: { sx: 0, sy: -1, cursor: 'ns-resize' },
  ne: { sx: 1, sy: -1, cursor: 'nesw-resize' },
  e: { sx: 1, sy: 0, cursor: 'ew-resize' },
  se: { sx: 1, sy: 1, cursor: 'nwse-resize' },
  s: { sx: 0, sy: 1, cursor: 'ns-resize' },
  sw: { sx: -1, sy: 1, cursor: 'nesw-resize' },
  w: { sx: -1, sy: 0, cursor: 'ew-resize' }
}

const getResizeSourceEdges = (handle: ResizeDirection) => {
  const sourceX = handle.includes('w') ? 'left' : handle.includes('e') ? 'right' : undefined
  const sourceY = handle.includes('n') ? 'top' : handle.includes('s') ? 'bottom' : undefined
  return { sourceX, sourceY }
}

const getGuideForX = (movingRect: Rect, target: SnapCandidate, sourceEdge: string, targetEdge: string): Guide => {
  const from = Math.min(movingRect.y, target.rect.y)
  const to = Math.max(movingRect.y + movingRect.height, target.rect.y + target.rect.height)
  return {
    axis: 'x',
    value: target.lines[targetEdge as keyof SnapCandidate['lines']],
    from,
    to,
    targetEdge: targetEdge as Guide['targetEdge'],
    sourceEdge: sourceEdge as Guide['sourceEdge']
  }
}

const getGuideForY = (movingRect: Rect, target: SnapCandidate, sourceEdge: string, targetEdge: string): Guide => {
  const from = Math.min(movingRect.x, target.rect.x)
  const to = Math.max(movingRect.x + movingRect.width, target.rect.x + target.rect.width)
  return {
    axis: 'y',
    value: target.lines[targetEdge as keyof SnapCandidate['lines']],
    from,
    to,
    targetEdge: targetEdge as Guide['targetEdge'],
    sourceEdge: sourceEdge as Guide['sourceEdge']
  }
}

const getWorldPoint = (
  event: ReactPointerEvent<HTMLElement>,
  containerRef?: RefObject<HTMLElement | null>,
  screenToWorld?: (point: Point) => Point
) => {
  if (!containerRef?.current || !screenToWorld) return null
  const rect = containerRef.current.getBoundingClientRect()
  const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  return screenToWorld(screenPoint)
}

const rotateVector = (vec: Point, rotation: number) => rotatePoint(vec, { x: 0, y: 0 }, rotation)

export const useNodeTransform = ({
  node,
  enabled,
  canRotate = true,
  minSize = { width: 20, height: 20 },
  handleSize = 10,
  rotateHandleOffset = 24
}: UseNodeTransformOptions) => {
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()
  const snap = useSnapRuntime()
  const selectedAtom = useMemo(
    () => selectAtom(nodeSelectionAtom, (selection) => selection.selectedNodeIds.has(node.id)),
    [node.id]
  )
  const selectedInSelectionSet = useAtomValue(selectedAtom)
  const tool = useAtomValue(toolAtom)
  const activeTool = (tool as 'select' | 'edge') ?? 'select'
  const resolvedEnabled = enabled ?? (activeTool === 'select' && selectedInSelectionSet)
  const containerRef = instance.containerRef ?? undefined
  const screenToWorld = instance.viewport.screenToWorld ?? undefined
  const getZoom = instance.viewport.getZoom
  const core: Core = instance.core
  const dragRef = useRef<DragState | null>(null)
  const [state, setState] = useState<TransformState>({ isResizing: false, isRotating: false })

  const rect = useMemo(() => getNodeRect(node, nodeSize), [node, nodeSize])
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0

  const handles = useMemo<TransformHandle[]>(() => {
    if (!resolvedEnabled || node.locked) return []
    const center = getRectCenter(rect)
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const localPositions: Record<ResizeDirection, Point> = {
      nw: { x: rect.x, y: rect.y },
      n: { x: cx, y: rect.y },
      ne: { x: rect.x + rect.width, y: rect.y },
      e: { x: rect.x + rect.width, y: cy },
      se: { x: rect.x + rect.width, y: rect.y + rect.height },
      s: { x: cx, y: rect.y + rect.height },
      sw: { x: rect.x, y: rect.y + rect.height },
      w: { x: rect.x, y: cy }
    }
    const positions = Object.fromEntries(
      (Object.keys(localPositions) as ResizeDirection[]).map((key) => [
        key,
        rotatePoint(localPositions[key], center, rotation)
      ])
    ) as Record<ResizeDirection, Point>
    const resizeHandles = (Object.keys(positions) as ResizeDirection[]).map((direction) => ({
      id: `resize-${direction}`,
      kind: 'resize' as const,
      direction,
      position: positions[direction],
      cursor: resizeMap[direction].cursor
    }))
    if (!canRotate) return resizeHandles
    const zoom = Math.max(getZoom(), 0.0001)
    const offsetWorld = rotateHandleOffset / zoom
    const topMid = positions.n
    const normal = rotateVector({ x: 0, y: -1 }, rotation)
    const rotateHandle: TransformHandle = {
      id: 'rotate',
      kind: 'rotate',
      position: { x: topMid.x + normal.x * offsetWorld, y: topMid.y + normal.y * offsetWorld },
      cursor: 'grab'
    }
    return [...resizeHandles, rotateHandle]
  }, [canRotate, getZoom, node.locked, rect, resolvedEnabled, rotation, rotateHandleOffset])

  const endDrag = useCallback(() => {
    dragRef.current = null
    setState({ isResizing: false, isRotating: false, activeHandleId: undefined })
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
        setState({ isResizing: true, isRotating: false, activeHandleId: handle.id })
        return
      }
      if (handle.kind === 'rotate' && canRotate) {
        const worldPoint = getWorldPoint(event, containerRef, screenToWorld)
        if (!worldPoint) return
        const center = getRectCenter(rect)
        const startAngle = Math.atan2(worldPoint.y - center.y, worldPoint.x - center.x)
        dragRef.current = {
          mode: 'rotate',
          pointerId: event.pointerId,
          startAngle,
          startRotation: rotation,
          center
        }
        setState({ isResizing: false, isRotating: true, activeHandleId: handle.id })
      }
    },
    [canRotate, containerRef, node.locked, rect, resolvedEnabled, rotation, screenToWorld]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      if (drag.mode === 'resize') {
        const zoom = Math.max(getZoom(), 0.0001)
        const { handle, startScreen, startCenter, startRotation, startSize, startAspect } = drag
        const deltaWorld = {
          x: (event.clientX - startScreen.x) / zoom,
          y: (event.clientY - startScreen.y) / zoom
        }
        const localDelta = rotateVector(deltaWorld, -startRotation)
        const { sx, sy } = resizeMap[handle]
        const isAlt = event.altKey
        let width = startSize.width
        let height = startSize.height
        if (sx !== 0) {
          width += localDelta.x * sx * (isAlt ? 2 : 1)
        }
        if (sy !== 0) {
          height += localDelta.y * sy * (isAlt ? 2 : 1)
        }
        if (event.shiftKey && sx !== 0 && sy !== 0) {
          if (Math.abs(localDelta.x) > Math.abs(localDelta.y)) {
            height = width / startAspect
          } else {
            width = height * startAspect
          }
        }
        width = Math.max(minSize.width, width)
        height = Math.max(minSize.height, height)
        let centerOffset = { x: 0, y: 0 }
        if (!isAlt) {
          if (sx !== 0) {
            centerOffset.x = ((width - startSize.width) * sx) / 2
          }
          if (sy !== 0) {
            centerOffset.y = ((height - startSize.height) * sy) / 2
          }
        }
        const worldCenterOffset = rotateVector(centerOffset, startRotation)
        const nextCenter = {
          x: startCenter.x + worldCenterOffset.x,
          y: startCenter.y + worldCenterOffset.y
        }
        const nextRect = {
          x: nextCenter.x - width / 2,
          y: nextCenter.y - height / 2
        }
        if (snap?.enabled && rotation === 0 && !event.altKey) {
          const thresholdWorld = snap.thresholdScreen / Math.max(getZoom(), 0.0001)
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
          const movingLines = {
            left: movingRect.x,
            right: movingRect.x + movingRect.width,
            centerX: movingRect.x + movingRect.width / 2,
            top: movingRect.y,
            bottom: movingRect.y + movingRect.height,
            centerY: movingRect.y + movingRect.height / 2
          }
          const { sourceX, sourceY } = getResizeSourceEdges(handle)
          let bestX:
            | { delta: number; target: SnapCandidate; targetEdge: string; sourceEdge: string; distance: number }
            | undefined
          let bestY:
            | { delta: number; target: SnapCandidate; targetEdge: string; sourceEdge: string; distance: number }
            | undefined
          const xTargets = ['left', 'right', 'centerX']
          const yTargets = ['top', 'bottom', 'centerY']
          candidates.forEach((candidate) => {
            if (candidate.id === node.id) return
            if (sourceX) {
              xTargets.forEach((targetEdge) => {
                const delta =
                  candidate.lines[targetEdge as keyof SnapCandidate['lines']] -
                  movingLines[sourceX as keyof typeof movingLines]
                const dist = Math.abs(delta)
                if (dist > thresholdWorld) return
                if (!bestX || dist < bestX.distance) {
                  bestX = { delta, target: candidate, targetEdge, sourceEdge: sourceX, distance: dist }
                }
              })
            }
            if (sourceY) {
              yTargets.forEach((targetEdge) => {
                const delta =
                  candidate.lines[targetEdge as keyof SnapCandidate['lines']] -
                  movingLines[sourceY as keyof typeof movingLines]
                const dist = Math.abs(delta)
                if (dist > thresholdWorld) return
                if (!bestY || dist < bestY.distance) {
                  bestY = { delta, target: candidate, targetEdge, sourceEdge: sourceY, distance: dist }
                }
              })
            }
          })
          const guides: Guide[] = []
          let nextLeft = nextRect.x
          let nextTop = nextRect.y
          let nextRight = nextRect.x + width
          let nextBottom = nextRect.y + height
          if (bestX && sourceX) {
            if (sourceX === 'left') {
              nextLeft += bestX.delta
            } else if (sourceX === 'right') {
              nextRight += bestX.delta
            }
            if (nextRight - nextLeft >= minSize.width) {
              width = nextRight - nextLeft
              nextRect.x = nextLeft
            }
            guides.push(getGuideForX(movingRect, bestX.target, bestX.sourceEdge, bestX.targetEdge))
          }
          if (bestY && sourceY) {
            if (sourceY === 'top') {
              nextTop += bestY.delta
            } else if (sourceY === 'bottom') {
              nextBottom += bestY.delta
            }
            if (nextBottom - nextTop >= minSize.height) {
              height = nextBottom - nextTop
              nextRect.y = nextTop
            }
            guides.push(getGuideForY(movingRect, bestY.target, bestY.sourceEdge, bestY.targetEdge))
          }
          snap.onGuidesChange?.(guides)
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
        const worldPoint = getWorldPoint(event, containerRef, screenToWorld)
        if (!worldPoint) return
        const angle = Math.atan2(worldPoint.y - drag.center.y, worldPoint.x - drag.center.x)
        let nextRotation = drag.startRotation + ((angle - drag.startAngle) * 180) / Math.PI
        if (event.shiftKey) {
          const step = 15
          nextRotation = Math.round(nextRotation / step) * step
        }
        core.dispatch({
          type: 'node.update',
          id: node.id,
          patch: {
            rotation: nextRotation
          }
        })
      }
    },
    [containerRef, core, getZoom, minSize.height, minSize.width, node.id, rotation, screenToWorld, snap]
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
        const isRotate = handle.kind === 'rotate'
        return (
          <div
            key={handle.id}
            data-selection-ignore
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `calc(${handleSize}px / var(--wb-zoom, 1))`,
              height: `calc(${handleSize}px / var(--wb-zoom, 1))`,
              borderRadius: isRotate ? 999 : 3,
              background: '#ffffff',
              border: '1px solid #2563eb',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              cursor: handle.cursor,
              pointerEvents: 'auto',
              zIndex: 9,
              transform: `translate(${handle.position.x - half}px, ${handle.position.y - half}px)`
            }}
            {...props}
          />
        )
      })
    },
    [getHandleProps, getZoom, handleSize, handles]
  )

  return {
    handles,
    state,
    getHandleProps,
    renderHandles
  }
}
