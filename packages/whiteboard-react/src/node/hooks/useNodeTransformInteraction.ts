import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  computeNextRotation,
  computeResizeRect,
  computeResizeSnap,
  getResizeSourceEdges,
  type ResizeDirection,
  type TransformHandle
} from '@whiteboard/core/node'
import { getRectCenter, isPointEqual, isSizeEqual } from '@whiteboard/core/geometry'
import type { NodeId, Point } from '@whiteboard/core/types'
import { useInstance } from '../../common/hooks'
import { sessionLockState, type SessionLockToken } from '../../common/interaction/sessionLockState'
import { useWindowPointerSession } from '../../common/interaction/useWindowPointerSession'
import { nodeInteractionPreviewState } from '../interaction/nodeInteractionPreviewState'

type UseNodeTransformInteractionOptions = {
  nodeId: NodeId
}

type ResizeDragState = {
  mode: 'resize'
  pointerId: number
  handle: ResizeDirection
  startScreen: Point
  startCenter: Point
  startRotation: number
  startSize: {
    width: number
    height: number
  }
  startAspect: number
  lastUpdate?: {
    position: Point
    size: {
      width: number
      height: number
    }
  }
}

type RotateDragState = {
  mode: 'rotate'
  pointerId: number
  startAngle: number
  startRotation: number
  currentRotation?: number
  center: Point
}

type ActiveTransform = {
  nodeId: NodeId
  drag: ResizeDragState | RotateDragState
}

const ZOOM_EPSILON = 0.0001
const RESIZE_MIN_SIZE = {
  width: 20,
  height: 20
}

const toPointerWorld = (
  clientX: number,
  clientY: number,
  clientToScreen: (clientX: number, clientY: number) => Point,
  screenToWorld: (screen: Point) => Point
) => {
  const screen = clientToScreen(clientX, clientY)
  return screenToWorld(screen)
}

const resolveSnapThresholdWorld = (
  snapThresholdScreen: number,
  snapMaxThresholdWorld: number,
  zoom: number
) =>
  Math.min(
    snapThresholdScreen / Math.max(zoom, ZOOM_EPSILON),
    snapMaxThresholdWorld
  )

const expandRectByThreshold = (
  rect: {
    x: number
    y: number
    width: number
    height: number
  },
  thresholdWorld: number
) => ({
  x: rect.x - thresholdWorld,
  y: rect.y - thresholdWorld,
  width: rect.width + thresholdWorld * 2,
  height: rect.height + thresholdWorld * 2
})

const resolveResizeDrag = (options: {
  pointerId: number
  handle: ResizeDirection
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  rotation: number
  startScreen: Point
}): ResizeDragState => {
  const {
    pointerId,
    handle,
    rect,
    rotation,
    startScreen
  } = options
  return {
    mode: 'resize',
    pointerId,
    handle,
    startScreen,
    startCenter: getRectCenter(rect),
    startRotation: rotation,
    startSize: {
      width: rect.width,
      height: rect.height
    },
    startAspect: rect.width / Math.max(rect.height, ZOOM_EPSILON)
  }
}

export const useNodeTransformInteraction = ({
  nodeId
}: UseNodeTransformInteractionOptions) => {
  const instance = useInstance()
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<ActiveTransform | null>(null)
  const lockTokenRef = useRef<SessionLockToken | null>(null)

  const clearActive = useCallback((pointerId?: number) => {
    const active = activeRef.current
    const lockToken = lockTokenRef.current
    if (!active) {
      if (
        lockToken
        && (
          pointerId === undefined
          || lockToken.pointerId === undefined
          || lockToken.pointerId === pointerId
        )
      ) {
        sessionLockState.release(instance, lockToken)
        lockTokenRef.current = null
      }
      return
    }
    if (pointerId !== undefined && active.drag.pointerId !== pointerId) return
    activeRef.current = null
    setActivePointerId(null)
    nodeInteractionPreviewState.clearTransient(instance)
    if (
      lockToken
      && (
        lockToken.pointerId === undefined
        || lockToken.pointerId === active.drag.pointerId
      )
    ) {
      sessionLockState.release(instance, lockToken)
      lockTokenRef.current = null
    }
  }, [instance])

  const commitTransform = useCallback((active: ActiveTransform) => {
    const node = instance.query.doc.get().nodes.find((item) => item.id === active.nodeId)
    if (!node) return

    if (active.drag.mode === 'resize') {
      const update = active.drag.lastUpdate
      if (!update) return
      const patch: {
        position?: Point
        size?: {
          width: number
          height: number
        }
      } = {}
      if (!isPointEqual(update.position, node.position)) {
        patch.position = update.position
      }
      if (!isSizeEqual(update.size, node.size)) {
        patch.size = update.size
      }
      if (!patch.position && !patch.size) return
      void instance.commands.node.update(active.nodeId, patch)
      return
    }

    if (typeof active.drag.currentRotation !== 'number') return
    const previousRotation = node.rotation ?? 0
    if (previousRotation === active.drag.currentRotation) return
    void instance.commands.node.update(active.nodeId, {
      rotation: active.drag.currentRotation
    })
  }, [instance.commands.node, instance.query.doc])

  const handleTransformPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      handle: TransformHandle
    ) => {
      if (event.button !== 0) return
      if (activeRef.current) return
      if (instance.state.read('tool') !== 'select') return

      const nodeRect = instance.query.canvas.nodeRect(nodeId)
      if (!nodeRect || nodeRect.node.locked) return

      let nextDrag: ResizeDragState | RotateDragState | undefined

      if (handle.kind === 'resize' && handle.direction) {
        nextDrag = resolveResizeDrag({
          pointerId: event.pointerId,
          handle: handle.direction,
          rect: nodeRect.rect,
          rotation: nodeRect.rotation,
          startScreen: {
            x: event.clientX,
            y: event.clientY
          }
        })
      }

      if (handle.kind === 'rotate') {
        const center = getRectCenter(nodeRect.rect)
        const world = toPointerWorld(
          event.clientX,
          event.clientY,
          instance.query.viewport.clientToScreen,
          instance.query.viewport.screenToWorld
        )
        const startAngle = Math.atan2(
          world.y - center.y,
          world.x - center.x
        )
        nextDrag = {
          mode: 'rotate',
          pointerId: event.pointerId,
          startAngle,
          startRotation: nodeRect.rotation,
          currentRotation: nodeRect.rotation,
          center
        }
      }

      if (!nextDrag) return
      const lockToken = sessionLockState.tryAcquire(instance, 'nodeTransform', event.pointerId)
      if (!lockToken) return

      activeRef.current = {
        nodeId,
        drag: nextDrag
      }
      lockTokenRef.current = lockToken
      setActivePointerId(event.pointerId)
      nodeInteractionPreviewState.clearTransient(instance)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [
      instance.query.canvas,
      instance.query.viewport.clientToScreen,
      instance.query.viewport.screenToWorld,
      instance.state,
      nodeId
    ]
  )

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.drag.pointerId) return

      if (active.drag.mode === 'resize') {
        const activeTool = instance.state.read('tool')
        const zoom = Math.max(instance.query.viewport.getZoom(), ZOOM_EPSILON)
        const resized = computeResizeRect({
          handle: active.drag.handle,
          startScreen: active.drag.startScreen,
          currentScreen: {
            x: event.clientX,
            y: event.clientY
          },
          startCenter: active.drag.startCenter,
          startRotation: active.drag.startRotation,
          startSize: active.drag.startSize,
          startAspect: active.drag.startAspect,
          minSize: RESIZE_MIN_SIZE,
          zoom,
          altKey: event.altKey,
          shiftKey: event.shiftKey
        })

        let nextRect = resized.rect
        let nextSize = {
          width: resized.width,
          height: resized.height
        }
        let guides: ReturnType<typeof computeResizeSnap>['guides'] = []

        if (activeTool === 'select' && !event.altKey && active.drag.startRotation === 0) {
          const config = instance.query.config.get()
          const thresholdWorld = resolveSnapThresholdWorld(
            config.node.snapThresholdScreen,
            config.node.snapMaxThresholdWorld,
            zoom
          )
          const movingRect = {
            x: nextRect.x,
            y: nextRect.y,
            width: nextSize.width,
            height: nextSize.height
          }
          const { sourceX, sourceY } = getResizeSourceEdges(active.drag.handle)
          const snapped = computeResizeSnap({
            movingRect,
            candidates: instance.query.snap.candidatesInRect(
              expandRectByThreshold(movingRect, thresholdWorld)
            ),
            threshold: thresholdWorld,
            minSize: RESIZE_MIN_SIZE,
            excludeId: active.nodeId,
            sourceEdges: {
              sourceX,
              sourceY
            }
          })
          nextRect = snapped.rect
          nextSize = {
            width: snapped.width,
            height: snapped.height
          }
          guides = snapped.guides
        }

        const update = {
          position: {
            x: nextRect.x,
            y: nextRect.y
          },
          size: nextSize
        }
        active.drag.lastUpdate = update
        nodeInteractionPreviewState.setTransient(instance, {
          updates: [{
            id: active.nodeId,
            position: update.position,
            size: update.size
          }],
          guides
        })
        return
      }

      const world = toPointerWorld(
        event.clientX,
        event.clientY,
        instance.query.viewport.clientToScreen,
        instance.query.viewport.screenToWorld
      )
      const rotation = computeNextRotation({
        center: active.drag.center,
        currentPoint: world,
        startAngle: active.drag.startAngle,
        startRotation: active.drag.startRotation,
        shiftKey: event.shiftKey
      })
      active.drag.currentRotation = rotation
      nodeInteractionPreviewState.setTransient(instance, {
        updates: [{
          id: active.nodeId,
          rotation
        }],
        guides: []
      })
    },

    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.drag.pointerId) return
      commitTransform(active)
      clearActive(active.drag.pointerId)
    },

    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.drag.pointerId) return
      clearActive(active.drag.pointerId)
    },

    onBlur: () => {
      clearActive()
    },

    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      clearActive()
    }
  })

  useEffect(
    () => () => {
      clearActive()
    },
    [clearActive]
  )

  return {
    handleTransformPointerDown
  }
}
