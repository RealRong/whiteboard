import { useCallback, useRef } from 'react'
import type { PointerEvent } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import type { Core, Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { Guide, SnapCandidate, SnapResult } from '../utils/snap'
import { computeSnap } from '../utils/snap'
import type { Size } from '../../common/types'
import { findSmallestGroupContainingPoint, getGroupDescendants, getNodesBoundingRect, expandGroupRect, rectEquals } from '../utils/group'
import { getNodeAABB, rectContains } from '../../common/utils/geometry'
import type { NodeTransientApi, NodeViewUpdate } from './useNodeViewState'
import { useInstance, useInteraction, useViewportStore, useWhiteboardConfig } from '../../common/hooks'
import { useGroupRuntime } from './useGroupRuntime'
import { useEdgeConnectRuntime } from '../../edge/hooks'
import { selectionAtom } from '../../common/state/whiteboardAtoms'
import { applySelectionMode, getSelectionModeFromEvent } from '../utils/selection'
import type { SelectionMode } from '../../common/state/whiteboardAtoms'
import type { UseEdgeConnectReturn } from '../../edge/hooks'
import { snapRuntimeAtom } from '../state/snapRuntimeAtom'
import { nodeTransientAtom } from '../state/nodeTransientAtom'

type SnapOptions = {
  enabled: boolean
  candidates: SnapCandidate[]
  getCandidates?: (rect: Rect) => SnapCandidate[]
  thresholdScreen: number
  zoom: number
  onGuidesChange?: (guides: Guide[]) => void
}

type GroupOptions = {
  nodes: Node[]
  nodeSize: Size
  padding?: number
  setHoveredGroupId?: (groupId?: NodeId) => void
}

type Options = {
  node: Node
}

export const useNodeInteraction = ({ node }: Options) => {
  const instance = useInstance()
  const viewport = useViewportStore()
  const { nodeSize } = useWhiteboardConfig()
  const selectionState = useAtomValue(selectionAtom)
  const updateSelection = useSetAtom(selectionAtom)
  const { update: updateInteraction } = useInteraction()
  const edgeConnectRuntime = useEdgeConnectRuntime()
  const groupRuntime = useGroupRuntime()
  const snapRuntime = useAtomValue(snapRuntimeAtom)
  const transientRuntime = useAtomValue(nodeTransientAtom)
  const tool = (selectionState.tool as 'select' | 'edge') ?? 'select'
  const edgeConnect: UseEdgeConnectReturn | undefined = edgeConnectRuntime ?? undefined
  const group: GroupOptions | undefined = groupRuntime ?? undefined
  const snap: SnapOptions | undefined = snapRuntime ?? undefined
  const transient: NodeTransientApi | undefined = transientRuntime ?? undefined
  const core: Core = instance.core
  const size = {
    width: node.size?.width ?? nodeSize.width,
    height: node.size?.height ?? nodeSize.height
  }

  const select = useCallback(
    (ids: string[], mode: SelectionMode = 'replace') => {
      updateSelection((prev) => ({
        ...prev,
        mode,
        selectedNodeIds: applySelectionMode(prev.selectedNodeIds, ids, mode)
      }))
    },
    [updateSelection]
  )

  const toggle = useCallback(
    (ids: string[]) => {
      updateSelection((prev) => ({
        ...prev,
        mode: 'toggle',
        selectedNodeIds: applySelectionMode(prev.selectedNodeIds, ids, 'toggle')
      }))
    },
    [updateSelection]
  )

  const dragHandlers = useNodeDrag(
    core,
    node.id,
    node.position,
    size,
    viewport.zoom,
    snap,
    group,
    transient
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (tool === 'edge' && edgeConnect) {
        const container = edgeConnect.containerRef?.current
        if (container && edgeConnect.screenToWorld) {
          const rect = container.getBoundingClientRect()
          const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
          const worldPoint = edgeConnect.screenToWorld(screenPoint)
          const handled = edgeConnect.handleNodePointerDown(node.id, worldPoint, event)
          if (handled) return
        }
        return
      }
      if (event.button === 0 && tool !== 'edge') {
        const mode = getSelectionModeFromEvent(event)
        if (mode === 'toggle') {
          toggle([node.id])
        } else {
          select([node.id], mode)
        }
      }
      dragHandlers.onPointerDown(event)
    },
    [dragHandlers, edgeConnect, node.id, select, toggle, tool]
  )

  const handleEdgeHandlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, side: 'top' | 'right' | 'bottom' | 'left') => {
      event.preventDefault()
      event.stopPropagation()
      edgeConnect?.startFromHandle(node.id, side, event.pointerId)
    },
    [edgeConnect, node.id]
  )

  const onPointerEnter = useCallback(() => {
    updateInteraction({ hover: { nodeId: node.id } })
  }, [node.id, updateInteraction])

  const onPointerLeave = useCallback(() => {
    updateInteraction({ hover: { nodeId: undefined } })
  }, [updateInteraction])

  return {
    dragHandlers,
    handlePointerDown,
    handleEdgeHandlePointerDown,
    onPointerEnter,
    onPointerLeave
  }
}

const SNAP_MAX_THRESHOLD_WORLD = 24

type DragState = {
  pointerId: number
  start: Point
  origin: Point
  last?: Point
  children?: {
    ids: NodeId[]
    offsets: Map<NodeId, Point>
  }
}

const useNodeDrag = (
  core: Core,
  nodeId: NodeId,
  position: Point,
  size: { width: number; height: number },
  zoom = 1,
  snap?: SnapOptions,
  group?: GroupOptions,
  transient?: NodeTransientApi
) => {
  const dragRef = useRef<DragState | null>(null)
  const hoverGroupRef = useRef<NodeId | undefined>(undefined)

  const updateHoverGroup = useCallback(
    (nextId?: NodeId) => {
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
      const currentNode = group?.nodes.find((node) => node.id === nodeId)
      const isGroup = currentNode?.type === 'group'
      const children =
        isGroup && group ? getGroupDescendants(group.nodes, nodeId).map((child) => child.id) : undefined
      const offsets = new Map<NodeId, Point>()
      if (isGroup && group && children?.length) {
        children.forEach((childId) => {
          const childNode = group.nodes.find((node) => node.id === childId)
          if (!childNode) return
          offsets.set(childId, {
            x: childNode.position.x - position.x,
            y: childNode.position.y - position.y
          })
        })
      }
      dragRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        origin: { x: position.x, y: position.y },
        last: { x: position.x, y: position.y },
        children: children?.length
          ? {
              ids: children,
              offsets
            }
          : undefined
      }
      updateHoverGroup(undefined)
    },
    [group, nodeId, position.x, position.y, updateHoverGroup]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.start.x
      const dy = event.clientY - drag.start.y
      let nextX = drag.origin.x + dx / zoom
      let nextY = drag.origin.y + dy / zoom
      const currentNode = group?.nodes.find((node) => node.id === nodeId)
      const isGroup = currentNode?.type === 'group'
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
        const excludeSet = drag.children?.ids?.length ? new Set([nodeId, ...drag.children.ids]) : undefined
        const candidates = excludeSet ? baseCandidates.filter((candidate) => !excludeSet.has(candidate.id)) : baseCandidates
        const result: SnapResult = computeSnap(movingRect, candidates, thresholdWorld, nodeId, {
          allowCross: event.altKey,
          crossThreshold: thresholdWorld * 0.6
        })
        if (result.dx !== undefined) nextX += result.dx
        if (result.dy !== undefined) nextY += result.dy
        snap.onGuidesChange?.(result.guides)
      }
      drag.last = { x: nextX, y: nextY }
      if (isGroup && drag.children) {
        const updates: NodeViewUpdate[] = [
          {
            id: nodeId,
            position: { x: nextX, y: nextY }
          }
        ]
        drag.children.ids.forEach((childId) => {
          const offset = drag.children?.offsets.get(childId)
          if (!offset) return
          updates.push({
            id: childId,
            position: { x: nextX + offset.x, y: nextY + offset.y }
          })
        })
        if (transient) {
          transient.setOverrides(updates)
        } else {
          core.model.node.updateMany(
            updates.map((item) => ({ id: item.id, patch: { position: item.position as Point } }))
          )
        }
        return
      }

      if (group) {
        const center = { x: nextX + size.width / 2, y: nextY + size.height / 2 }
        const hovered = findSmallestGroupContainingPoint(group.nodes, group.nodeSize, center, nodeId)
        updateHoverGroup(hovered?.id)
      }

      if (transient) {
        transient.setOverrides([{ id: nodeId, position: { x: nextX, y: nextY } }])
        return
      }

      core.dispatch({
        type: 'node.update',
        id: nodeId,
        patch: {
          position: { x: nextX, y: nextY }
        }
      })
    },
    [core, group, nodeId, size.height, size.width, snap, transient, updateHoverGroup, zoom]
  )

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    snap?.onGuidesChange?.([])
    if (transient) {
      const finalPos = drag.last ?? { x: position.x, y: position.y }
      const updates: NodeViewUpdate[] = [{ id: nodeId, position: finalPos }]
      if (drag.children) {
        drag.children.ids.forEach((childId) => {
          const offset = drag.children?.offsets.get(childId)
          if (!offset) return
          updates.push({ id: childId, position: { x: finalPos.x + offset.x, y: finalPos.y + offset.y } })
        })
      }
      transient.commitOverrides(updates)
    }
    if (group) {
      const currentNode = group.nodes.find((node) => node.id === nodeId)
      const isGroup = currentNode?.type === 'group'
      if (!isGroup && currentNode) {
        const hoveredId = hoverGroupRef.current
        const parentId = currentNode.parentId
        if (hoveredId && hoveredId !== parentId) {
          const hovered = group.nodes.find((node) => node.id === hoveredId)
          if (hovered) {
            core.dispatch({ type: 'node.update', id: nodeId, patch: { parentId: hovered.id } })
            const groupRect = getNodeAABB(hovered, group.nodeSize)
            const children = getGroupDescendants(group.nodes, hovered.id)
            const finalPos = drag.last ?? currentNode.position
            const virtualNode: Node = {
              ...currentNode,
              position: finalPos
            }
            const contentRect = getNodesBoundingRect([...children, virtualNode], group.nodeSize)
            if (contentRect) {
              const padding =
                hovered.data && typeof hovered.data.padding === 'number' ? hovered.data.padding : group.padding ?? 24
              const expanded = expandGroupRect(groupRect, contentRect, padding)
              if (!rectEquals(expanded, groupRect)) {
                core.dispatch({
                  type: 'node.update',
                  id: hovered.id,
                  patch: {
                    position: { x: expanded.x, y: expanded.y },
                    size: { width: expanded.width, height: expanded.height }
                  }
                })
              }
            }
          }
        } else if (!hoveredId && parentId) {
          const parent = group.nodes.find((node) => node.id === parentId)
          if (parent) {
            const finalPos = drag.last ?? currentNode.position
            const nodeRect = { x: finalPos.x, y: finalPos.y, width: size.width, height: size.height }
            const parentRect = getNodeAABB(parent, group.nodeSize)
            if (!rectContains(parentRect, nodeRect)) {
              core.dispatch({ type: 'node.update', id: nodeId, patch: { parentId: undefined } })
            }
          }
        }
      }
      updateHoverGroup(undefined)
    }
  }, [core, group, nodeId, position.x, position.y, size.height, size.width, snap, transient, updateHoverGroup])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp
  }
}
