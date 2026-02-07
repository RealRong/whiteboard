import { useCallback, useMemo, useRef } from 'react'
import type { PointerEvent } from 'react'
import type { Core, Node, Rect } from '@whiteboard/core'
import { computeSnap } from '../utils/snap'
import { selectNodeDragStrategy } from '../runtime/drag'
import type {
  DragState,
  NodeDragGroupOptions,
  NodeDragHandlers,
  NodeDragSnapOptions,
  NodeDragTransientApi
} from '../runtime/drag'

export type { NodeDragGroupOptions, NodeDragHandlers, NodeDragSnapOptions } from '../runtime/drag'

type UseNodeDragOptions = {
  core: Core
  nodeId: Node['id']
  nodeType: Node['type']
  position: Node['position']
  size: { width: number; height: number }
  zoom?: number
  snap?: NodeDragSnapOptions
  group?: NodeDragGroupOptions
  transient?: NodeDragTransientApi
}

const SNAP_MAX_THRESHOLD_WORLD = 24

export const useNodeDrag = ({
  core,
  nodeId,
  nodeType,
  position,
  size,
  zoom = 1,
  snap,
  group,
  transient
}: UseNodeDragOptions): NodeDragHandlers => {
  const dragRef = useRef<DragState | null>(null)
  const hoverGroupRef = useRef<Node['id'] | undefined>(undefined)

  const strategy = useMemo(() => selectNodeDragStrategy(nodeType, group), [group, nodeType])

  const updateHoverGroup = useCallback(
    (nextId?: Node['id']) => {
      if (hoverGroupRef.current === nextId) return
      hoverGroupRef.current = nextId
      group?.setHoveredGroupId?.(nextId)
    },
    [group]
  )

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)
      const children = strategy.initialize({
        core,
        nodeId,
        nodeType,
        position,
        size,
        group,
        transient,
        updateHoverGroup,
        getHoverGroupId: () => hoverGroupRef.current
      })
      dragRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        origin: { x: position.x, y: position.y },
        last: { x: position.x, y: position.y },
        children
      }
      updateHoverGroup(undefined)
    },
    [core, group, nodeId, nodeType, position, size, strategy, transient, updateHoverGroup]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.start.x
      const dy = event.clientY - drag.start.y
      let nextX = drag.origin.x + dx / zoom
      let nextY = drag.origin.y + dy / zoom

      if (snap?.enabled) {
        const thresholdWorld = Math.min(
          snap.thresholdScreen / Math.max(snap.zoom, 0.0001),
          SNAP_MAX_THRESHOLD_WORLD
        )
        const movingRect: Rect = { x: nextX, y: nextY, width: size.width, height: size.height }
        const queryRect: Rect = {
          x: movingRect.x - thresholdWorld,
          y: movingRect.y - thresholdWorld,
          width: movingRect.width + thresholdWorld * 2,
          height: movingRect.height + thresholdWorld * 2
        }
        const baseCandidates = snap.getCandidates ? snap.getCandidates(queryRect) : snap.candidates
        const excludeSet = drag.children?.ids.length ? new Set([nodeId, ...drag.children.ids]) : undefined
        const candidates = excludeSet ? baseCandidates.filter((candidate) => !excludeSet.has(candidate.id)) : baseCandidates
        const result = computeSnap(movingRect, candidates, thresholdWorld, nodeId, {
          allowCross: event.altKey,
          crossThreshold: thresholdWorld * 0.6
        })
        if (result.dx !== undefined) nextX += result.dx
        if (result.dy !== undefined) nextY += result.dy
        snap.onGuidesChange?.(result.guides)
      }

      drag.last = { x: nextX, y: nextY }

      strategy.handleMove({
        core,
        drag,
        nodeId,
        nodeType,
        position,
        size,
        group,
        transient,
        updateHoverGroup,
        getHoverGroupId: () => hoverGroupRef.current,
        nextPosition: { x: nextX, y: nextY }
      })
    },
    [core, group, nodeId, nodeType, position, size, snap, strategy, transient, updateHoverGroup, zoom]
  )

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      snap?.onGuidesChange?.([])

      strategy.handlePointerUp({
        core,
        drag,
        nodeId,
        nodeType,
        position,
        size,
        group,
        transient,
        updateHoverGroup,
        getHoverGroupId: () => hoverGroupRef.current
      })
    },
    [core, group, nodeId, nodeType, position, size, snap, strategy, transient, updateHoverGroup]
  )

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp
  }
}
