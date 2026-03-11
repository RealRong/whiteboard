import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  getNodeAABB,
  isPointEqual,
  isSizeEqual,
  rectContains
} from '@whiteboard/core/geometry'
import {
  computeSnap,
  resolveSelectionMode,
  expandGroupRect,
  findSmallestGroupAtPoint,
  getGroupDescendants,
  getNodesBoundingRect,
  rectEquals
} from '@whiteboard/core/node'
import type { Node, NodeId, NodePatch, Point, Rect } from '@whiteboard/core/types'
import { useInternalInstance as useInstance } from '../../common/hooks'
import { interactionLock, type InteractionLockToken } from '../../common/interaction/interactionLock'
import { useWindowPointerSession } from '../../common/interaction/useWindowPointerSession'
import { nodeInteractionPreviewState } from '../interaction/nodeInteractionPreviewState'

type UseNodeDragInteractionOptions = {
  nodeId: NodeId
}

type GroupChildren = {
  ids: NodeId[]
  offsets: Map<NodeId, Point>
}

type ActiveDrag = {
  pointerId: number
  nodeId: NodeId
  nodeType: Node['type']
  start: Point
  origin: Point
  last: Point
  size: {
    width: number
    height: number
  }
  children?: GroupChildren
  hoveredGroupId?: NodeId
}

const ZOOM_EPSILON = 0.0001
const SNAP_CROSS_THRESHOLD_RATIO = 0.6
const GROUP_RECT_EPSILON = 0.5

const toNodeById = (nodes: Node[]) => new Map(nodes.map((node) => [node.id, node]))

const hasParentIdPatch = (
  patch: NodePatch
): patch is NodePatch & { parentId: NodeId | undefined } =>
  Object.prototype.hasOwnProperty.call(patch, 'parentId')

const mergePatch = (
  patches: Map<NodeId, NodePatch>,
  id: NodeId,
  patch: NodePatch
) => {
  if (!Object.keys(patch).length) return
  const prev = patches.get(id)
  patches.set(id, prev ? { ...prev, ...patch } : { ...patch })
}

const normalizePatch = (
  currentNode: Node,
  patch: NodePatch
): NodePatch | undefined => {
  const normalized: NodePatch = {}

  if (patch.position && !isPointEqual(patch.position, currentNode.position)) {
    normalized.position = patch.position
  }
  if (patch.size && !isSizeEqual(patch.size, currentNode.size)) {
    normalized.size = patch.size
  }
  if (hasParentIdPatch(patch) && patch.parentId !== currentNode.parentId) {
    normalized.parentId = patch.parentId
  }

  return Object.keys(normalized).length ? normalized : undefined
}

const buildGroupChildren = (
  nodes: Node[],
  nodeId: NodeId,
  origin: Point
): GroupChildren | undefined => {
  const ids = getGroupDescendants(nodes, nodeId).map((child) => child.id)
  if (!ids.length) return undefined

  const nodeById = toNodeById(nodes)
  const offsets = new Map<NodeId, Point>()
  ids.forEach((childId) => {
    const childNode = nodeById.get(childId)
    if (!childNode) return
    offsets.set(childId, {
      x: childNode.position.x - origin.x,
      y: childNode.position.y - origin.y
    })
  })

  return {
    ids,
    offsets
  }
}

const buildGroupUpdates = (
  draft: ActiveDrag,
  position: Point
) => {
  const updates: Array<{ id: NodeId; position: Point }> = [{
    id: draft.nodeId,
    position
  }]

  draft.children?.ids.forEach((childId) => {
    const offset = draft.children?.offsets.get(childId)
    if (!offset) return
    updates.push({
      id: childId,
      position: {
        x: position.x + offset.x,
        y: position.y + offset.y
      }
    })
  })

  return updates
}

const resolveSnapThresholdWorld = (
  snapThresholdScreen: number,
  snapMaxThresholdWorld: number,
  zoom: number
) => Math.min(snapThresholdScreen / Math.max(zoom, ZOOM_EPSILON), snapMaxThresholdWorld)

const expandRectByThreshold = (
  rect: Rect,
  thresholdWorld: number
): Rect => ({
  x: rect.x - thresholdWorld,
  y: rect.y - thresholdWorld,
  width: rect.width + thresholdWorld * 2,
  height: rect.height + thresholdWorld * 2
})

export const useNodeDragInteraction = ({
  nodeId
}: UseNodeDragInteractionOptions) => {
  const instance = useInstance()
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<ActiveDrag | null>(null)
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
    nodeInteractionPreviewState.clearTransient(instance)
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

  const readCanvasNodes = useCallback(
    () => instance.read.index.node.all().map((entry) => entry.node),
    [instance]
  )

  const commitDrag = useCallback((draft: ActiveDrag) => {
    const nodes = readCanvasNodes()
    const nodeById = toNodeById(nodes)
    const currentNode = nodeById.get(draft.nodeId)
    if (!currentNode) return

    const updates = draft.children
      ? buildGroupUpdates(draft, draft.last)
      : [{
        id: draft.nodeId,
        position: draft.last
      }]

    const patches = new Map<NodeId, NodePatch>()
    updates.forEach((update) => {
      mergePatch(patches, update.id, {
        position: update.position
      })
    })

    if (!draft.children && draft.nodeType !== 'group') {
      const parentId = currentNode.parentId
      const hoveredGroupId = draft.hoveredGroupId

      if (hoveredGroupId && hoveredGroupId !== parentId) {
        const hoveredGroup = nodeById.get(hoveredGroupId)
        if (hoveredGroup) {
          mergePatch(patches, draft.nodeId, {
            parentId: hoveredGroup.id
          })
          const config = instance.config
          const groupRect = getNodeAABB(hoveredGroup, config.nodeSize)
          const children = getGroupDescendants(nodes, hoveredGroup.id)
          const virtualNode: Node = {
            ...currentNode,
            position: draft.last
          }
          const contentRect = getNodesBoundingRect(
            [...children, virtualNode],
            config.nodeSize
          )
          if (contentRect) {
            const padding =
              hoveredGroup.data && typeof hoveredGroup.data.padding === 'number'
                ? hoveredGroup.data.padding
                : config.node.groupPadding
            const expanded = expandGroupRect(groupRect, contentRect, padding)
            if (!rectEquals(expanded, groupRect, GROUP_RECT_EPSILON)) {
              mergePatch(patches, hoveredGroup.id, {
                position: {
                  x: expanded.x,
                  y: expanded.y
                },
                size: {
                  width: expanded.width,
                  height: expanded.height
                }
              })
            }
          }
        }
      } else if (!hoveredGroupId && parentId) {
        const parentNode = nodeById.get(parentId)
        if (parentNode) {
          const parentRect = getNodeAABB(parentNode, instance.config.nodeSize)
          const nodeRect = {
            x: draft.last.x,
            y: draft.last.y,
            width: draft.size.width,
            height: draft.size.height
          }
          if (!rectContains(parentRect, nodeRect)) {
            mergePatch(patches, draft.nodeId, {
              parentId: undefined
            })
          }
        }
      }
    }

    const positionUpdates: Array<{ id: NodeId; patch: NodePatch }> = []
    const patchUpdates: Array<{ id: NodeId; patch: NodePatch }> = []
    patches.forEach((patch, id) => {
      const current = nodeById.get(id)
      if (!current) return
      const normalized = normalizePatch(current, patch)
      if (!normalized) return
      const keys = Object.keys(normalized)
      if (
        keys.length === 1
        && normalized.position
      ) {
        positionUpdates.push({
          id,
          patch: { position: normalized.position }
        })
        return
      }
      patchUpdates.push({
        id,
        patch: normalized
      })
    })

    if (positionUpdates.length) {
      instance.commands.node.updateMany(positionUpdates)
    }
    patchUpdates.forEach((update) => {
      void instance.commands.node.update(update.id, update.patch)
    })
  }, [instance, readCanvasNodes])

  const handleNodePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      if (activeRef.current) return
      if (instance.state.tool.get() !== 'select') return

      const nodeRect = instance.read.index.node.byId(nodeId)
      if (!nodeRect || nodeRect.node.locked) return
      const lockToken = interactionLock.tryAcquire(instance, 'nodeDrag', event.pointerId)
      if (!lockToken) return

      instance.commands.selection.select(
        [nodeId],
        resolveSelectionMode(event)
      )

      const origin = {
        x: nodeRect.node.position.x,
        y: nodeRect.node.position.y
      }
      const size = {
        width: nodeRect.rect.width,
        height: nodeRect.rect.height
      }
      const children = nodeRect.node.type === 'group'
        ? buildGroupChildren(readCanvasNodes(), nodeRect.node.id, origin)
        : undefined
      const draft: ActiveDrag = {
        pointerId: event.pointerId,
        nodeId: nodeRect.node.id,
        nodeType: nodeRect.node.type,
        start: {
          x: event.clientX,
          y: event.clientY
        },
        origin,
        last: origin,
        size,
        children
      }
      activeRef.current = draft
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
    [instance, nodeId, readCanvasNodes]
  )

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      const zoom = Math.max(instance.viewport.get().zoom, ZOOM_EPSILON)
      const basePosition = {
        x: active.origin.x + (event.clientX - active.start.x) / zoom,
        y: active.origin.y + (event.clientY - active.start.y) / zoom
      }

      const snapEnabled = instance.state.tool.get() === 'select'
      const allowCross = event.altKey
      const config = instance.config
      let position = basePosition
      let guides: ReturnType<typeof computeSnap>['guides'] = []

      if (snapEnabled) {
        const thresholdWorld = resolveSnapThresholdWorld(
          config.node.snapThresholdScreen,
          config.node.snapMaxThresholdWorld,
          zoom
        )
        const movingRect: Rect = {
          x: basePosition.x,
          y: basePosition.y,
          width: active.size.width,
          height: active.size.height
        }
        const queryRect = expandRectByThreshold(movingRect, thresholdWorld)
        const exclude = active.children?.ids.length
          ? new Set([active.nodeId, ...active.children.ids])
          : new Set([active.nodeId])
        const candidates = instance.read.index.snap.inRect(queryRect)
          .filter((candidate) => !exclude.has(candidate.id as NodeId))
        const snapResult = computeSnap(
          movingRect,
          candidates,
          thresholdWorld,
          active.nodeId,
          {
            allowCross,
            crossThreshold:
              thresholdWorld * SNAP_CROSS_THRESHOLD_RATIO
          }
        )
        guides = snapResult.guides
        position = {
          x:
            snapResult.dx !== undefined
              ? basePosition.x + snapResult.dx
              : basePosition.x,
          y:
            snapResult.dy !== undefined
              ? basePosition.y + snapResult.dy
              : basePosition.y
        }
      }

      active.last = position
      active.hoveredGroupId = active.children
        ? undefined
        : findSmallestGroupAtPoint(
          readCanvasNodes(),
          config.nodeSize,
          {
            x: position.x + active.size.width / 2,
            y: position.y + active.size.height / 2
          },
          active.nodeId
        )?.id

      const updates = active.children
        ? buildGroupUpdates(active, position)
        : [{
          id: active.nodeId,
          position
        }]
      nodeInteractionPreviewState.setTransient(instance, {
        updates,
        guides,
        hoveredGroupId: active.hoveredGroupId
      })
    },

    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      commitDrag(active)
      clearActive(active.pointerId)
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

  return {
    handleNodePointerDown
  }
}
