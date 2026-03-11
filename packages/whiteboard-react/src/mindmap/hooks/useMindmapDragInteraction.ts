import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  computeSubtreeDropTarget,
  getSubtreeIds
} from '@whiteboard/core/mindmap'
import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { MindmapDragView, MindmapViewTree } from '@whiteboard/engine'
import { useInternalInstance as useInstance } from '../../common/hooks'
import { interactionLock, type InteractionLockToken } from '../../common/interaction/interactionLock'
import { useWindowPointerSession } from '../../common/interaction/useWindowPointerSession'

type RootDragSession = {
  kind: 'root'
  treeId: NodeId
  pointerId: number
  start: Point
  origin: Point
  position: Point
}

type SubtreeDragSession = {
  kind: 'subtree'
  treeId: NodeId
  pointerId: number
  nodeId: MindmapNodeId
  originParentId?: MindmapNodeId
  originIndex?: number
  baseOffset: Point
  offset: Point
  rect: Rect
  ghost: Rect
  excludeIds: MindmapNodeId[]
  layout: MindmapViewTree['layout']
  drop?: MindmapDragDropTarget
}

type MindmapDragSession = RootDragSession | SubtreeDragSession

const toPointerWorld = (
  clientX: number,
  clientY: number,
  clientToScreen: (clientX: number, clientY: number) => Point,
  screenToWorld: (screen: Point) => Point
) => {
  const screen = clientToScreen(clientX, clientY)
  return screenToWorld(screen)
}

const toDragView = (session: MindmapDragSession): MindmapDragView => {
  if (session.kind === 'root') {
    return {
      treeId: session.treeId,
      kind: 'root',
      baseOffset: session.position
    }
  }
  return {
    treeId: session.treeId,
    kind: 'subtree',
    baseOffset: session.baseOffset,
    preview: {
      nodeId: session.nodeId,
      ghost: session.ghost,
      drop: session.drop
    }
  }
}

const buildNodeRectMap = (
  item: MindmapViewTree,
  baseOffset: Point
) => {
  const rectMap = new Map<MindmapNodeId, Rect>()
  Object.entries(item.computed.node).forEach(([id, rect]) => {
    if (!rect) return
    rectMap.set(id as MindmapNodeId, {
      x: rect.x + item.shiftX + baseOffset.x,
      y: rect.y + item.shiftY + baseOffset.y,
      width: rect.width,
      height: rect.height
    })
  })
  return rectMap
}

const buildGhostRect = (
  pointerWorld: Point,
  pointerOffset: Point,
  nodeRect: Rect
): Rect => ({
  x: pointerWorld.x - pointerOffset.x,
  y: pointerWorld.y - pointerOffset.y,
  width: nodeRect.width,
  height: nodeRect.height
})

const resolveTreeView = (
  treeId: NodeId,
  readTree: (treeId: NodeId) => MindmapViewTree | undefined
) => readTree(treeId)

export const useMindmapDragInteraction = () => {
  const instance = useInstance()
  const [drag, setDrag] = useState<MindmapDragView | undefined>(undefined)
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<MindmapDragSession | null>(null)
  const lockTokenRef = useRef<InteractionLockToken | null>(null)

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
        interactionLock.release(instance, lockToken)
        lockTokenRef.current = null
      }
      return
    }
    if (pointerId !== undefined && active.pointerId !== pointerId) return
    activeRef.current = null
    setActivePointerId(null)
    setDrag(undefined)
    if (
      lockToken
      && (
        lockToken.pointerId === undefined
        || lockToken.pointerId === active.pointerId
      )
    ) {
      interactionLock.release(instance, lockToken)
      lockTokenRef.current = null
    }
  }, [instance])

  const readTree = useCallback(
    (treeId: NodeId) => instance.read.mindmap.get(treeId),
    [instance.read]
  )

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      const world = toPointerWorld(
        event.clientX,
        event.clientY,
        instance.viewport.clientToScreen,
        instance.viewport.screenToWorld
      )

      if (active.kind === 'root') {
        const next: RootDragSession = {
          ...active,
          position: {
            x: active.origin.x + (world.x - active.start.x),
            y: active.origin.y + (world.y - active.start.y)
          }
        }
        activeRef.current = next
        setDrag(toDragView(next))
        return
      }

      const ghost = buildGhostRect(world, active.offset, active.rect)
      const treeView = resolveTreeView(active.treeId, readTree)
      let drop = active.drop
      if (treeView) {
        const nodeRects = buildNodeRectMap(treeView, active.baseOffset)
        drop = computeSubtreeDropTarget({
          tree: treeView.tree,
          nodeRects,
          ghost,
          dragNodeId: active.nodeId,
          dragExcludeIds: new Set(active.excludeIds),
          layoutOptions: treeView.layout.options
        })
      }

      const next: SubtreeDragSession = {
        ...active,
        ghost,
        drop,
        layout: treeView?.layout ?? active.layout
      }
      activeRef.current = next
      setDrag(toDragView(next))
    },

    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      clearActive(active.pointerId)

      if (active.kind === 'root') {
        void instance.commands.mindmap.moveRoot({
          nodeId: active.treeId,
          position: active.position
        })
        return
      }

      if (!active.drop) return
      void instance.commands.mindmap.moveDrop({
        id: active.treeId,
        nodeId: active.nodeId,
        drop: {
          parentId: active.drop.parentId,
          index: active.drop.index,
          side: active.drop.side
        },
        origin: {
          parentId: active.originParentId,
          index: active.originIndex
        },
        nodeSize: instance.config.mindmapNodeSize,
        layout: active.layout
      })
    },

    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      clearActive(active.pointerId)
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

  const handleMindmapNodePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      treeId: NodeId,
      nodeId: MindmapNodeId
    ) => {
      if (event.button !== 0) return
      if (activeRef.current) return
      if (
        event.target instanceof Element
        && event.target.closest('[data-selection-ignore]')
      ) {
        return
      }

      const treeView = resolveTreeView(treeId, readTree)
      if (!treeView) return
      const world = toPointerWorld(
        event.clientX,
        event.clientY,
        instance.viewport.clientToScreen,
        instance.viewport.screenToWorld
      )
      const baseOffset = {
        x: treeView.node.position.x,
        y: treeView.node.position.y
      }
      let nextActive: MindmapDragSession | undefined

      if (nodeId === treeView.tree.rootId) {
        nextActive = {
          kind: 'root',
          treeId,
          pointerId: event.pointerId,
          start: world,
          origin: baseOffset,
          position: baseOffset
        }
      } else {
        const nodeRects = buildNodeRectMap(treeView, baseOffset)
        const rect = nodeRects.get(nodeId)
        if (!rect) return
        const originParentId = treeView.tree.nodes[nodeId]?.parentId
        const originIndex =
          originParentId !== undefined
            ? (treeView.tree.children[originParentId] ?? []).indexOf(nodeId)
            : undefined

        nextActive = {
          kind: 'subtree',
          treeId,
          pointerId: event.pointerId,
          nodeId,
          originParentId,
          originIndex,
          baseOffset,
          offset: {
            x: world.x - rect.x,
            y: world.y - rect.y
          },
          rect,
          ghost: rect,
          excludeIds: getSubtreeIds(treeView.tree, nodeId),
          layout: treeView.layout
        }
      }
      if (!nextActive) return

      const lockToken = interactionLock.tryAcquire(
        instance,
        'mindmapDrag',
        event.pointerId
      )
      if (!lockToken) return
      lockTokenRef.current = lockToken
      activeRef.current = nextActive
      setActivePointerId(event.pointerId)
      setDrag(toDragView(nextActive))
      event.preventDefault()
      event.stopPropagation()
    },
    [instance, readTree]
  )

  return {
    drag,
    handleMindmapNodePointerDown,
    isDragging: activePointerId !== null
  }
}
