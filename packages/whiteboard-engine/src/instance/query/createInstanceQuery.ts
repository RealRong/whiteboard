import { getEdgePath } from '@whiteboard/core'
import type {
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardStateNamespace
} from '@engine-types/instance'
import type { ShortcutContext, ShortcutNativeEvent } from '@engine-types/shortcuts'
import {
  distancePointToSegment,
  getAnchorPoint,
  getNodeAABB,
  getNodeRect,
  getRectCenter,
  rectContainsRotatedRect,
  rectIntersectsRotatedRect
} from '../../geometry/geometry'
import { buildSnapCandidates, createGridIndex, queryGridIndex } from '../../node/utils/snap'
import { getAnchorFromPoint, getAutoAnchorFromRect } from '../edge/edgeConnectUtils'

type CreateInstanceQueryOptions = {
  readState: WhiteboardStateNamespace['read']
  platform: ShortcutContext['platform']
  config: WhiteboardInstanceConfig
  getViewportZoom: () => number
  getContainer: () => HTMLDivElement | null
}

const isEditableElement = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('input, textarea, select')) return true
  return false
}

export const createInstanceQuery = ({
  readState,
  platform,
  config,
  getViewportZoom,
  getContainer
}: CreateInstanceQueryOptions): WhiteboardInstanceQuery => {
  let cachedNodes = readState('canvasNodes')
  let cachedRects = cachedNodes.map((node) => ({
    node,
    rect: getNodeRect(node, config.nodeSize),
    aabb: getNodeAABB(node, config.nodeSize),
    rotation: typeof node.rotation === 'number' ? node.rotation : 0
  }))
  let cachedById = new Map(cachedRects.map((entry) => [entry.node.id, entry]))

  const buildSnapCandidatesFromNodes = (nodes: typeof cachedNodes) =>
    buildSnapCandidates(
      nodes.map((node) => ({
        id: node.id,
        rect: getNodeAABB(node, config.nodeSize)
      }))
    )
  const toSnapGridCellSize = () => Math.max(config.node.snapGridCellSize, config.node.groupPadding * 6)

  let cachedSnapNodes = cachedNodes
  let cachedSnapCandidates = buildSnapCandidatesFromNodes(cachedSnapNodes)
  let cachedSnapIndex = createGridIndex(cachedSnapCandidates, toSnapGridCellSize())

  const ensureSnapCache = () => {
    const nodes = readState('canvasNodes')
    if (nodes === cachedSnapNodes) return
    cachedSnapNodes = nodes
    cachedSnapCandidates = buildSnapCandidatesFromNodes(nodes)
    cachedSnapIndex = createGridIndex(cachedSnapCandidates, toSnapGridCellSize())
  }

  const getCanvasNodeRects: WhiteboardInstanceQuery['getCanvasNodeRects'] = () => {
    const nodes = readState('canvasNodes')
    if (nodes === cachedNodes) return cachedRects
    cachedNodes = nodes
    cachedRects = nodes.map((node) => ({
      node,
      rect: getNodeRect(node, config.nodeSize),
      aabb: getNodeAABB(node, config.nodeSize),
      rotation: typeof node.rotation === 'number' ? node.rotation : 0
    }))
    cachedById = new Map(cachedRects.map((entry) => [entry.node.id, entry]))
    return cachedRects
  }

  const getCanvasNodeRectById: WhiteboardInstanceQuery['getCanvasNodeRectById'] = (nodeId) => {
    getCanvasNodeRects()
    return cachedById.get(nodeId)
  }

  const getNodeIdsInRect: WhiteboardInstanceQuery['getNodeIdsInRect'] = (rect) =>
    getCanvasNodeRects()
      .filter((entry) => {
        if (entry.node.type === 'group') {
          return rectContainsRotatedRect(rect, entry.rect, entry.rotation)
        }
        return rectIntersectsRotatedRect(rect, entry.rect, entry.rotation)
      })
      .map((entry) => entry.node.id)

  const getSnapCandidates: WhiteboardInstanceQuery['getSnapCandidates'] = () => {
    ensureSnapCache()
    return cachedSnapCandidates
  }

  const getSnapCandidatesInRect: WhiteboardInstanceQuery['getSnapCandidatesInRect'] = (rect) => {
    ensureSnapCache()
    return queryGridIndex(cachedSnapIndex, rect)
  }

  const isCanvasBackgroundTarget: WhiteboardInstanceQuery['isCanvasBackgroundTarget'] = (target) => {
    const container = getContainer()
    if (!(target instanceof HTMLElement)) return false
    if (!container?.contains(target)) return false
    if (target.closest('[data-node-id]')) return false
    if (target.closest('[data-mindmap-node-id]')) return false
    if (target.closest('[data-selection-ignore]')) return false
    return true
  }

  const getEdgeResolvedEndpoints: WhiteboardInstanceQuery['getEdgeResolvedEndpoints'] = (edge) => {
    const sourceEntry = getCanvasNodeRectById(edge.source.nodeId)
    const targetEntry = getCanvasNodeRectById(edge.target.nodeId)
    if (!sourceEntry || !targetEntry) return undefined

    const sourceCenter = getRectCenter(sourceEntry.rect)
    const targetCenter = getRectCenter(targetEntry.rect)

    const sourceAuto = getAutoAnchorFromRect(sourceEntry.rect, sourceEntry.rotation, targetCenter)
    const targetAuto = getAutoAnchorFromRect(targetEntry.rect, targetEntry.rotation, sourceCenter)

    const sourceAnchor = edge.source.anchor ?? sourceAuto.anchor
    const targetAnchor = edge.target.anchor ?? targetAuto.anchor

    const sourcePoint = edge.source.anchor
      ? getAnchorPoint(sourceEntry.rect, sourceAnchor, sourceEntry.rotation)
      : sourceAuto.point
    const targetPoint = edge.target.anchor
      ? getAnchorPoint(targetEntry.rect, targetAnchor, targetEntry.rotation)
      : targetAuto.point

    return {
      source: {
        nodeId: sourceEntry.node.id,
        anchor: sourceAnchor,
        point: sourcePoint
      },
      target: {
        nodeId: targetEntry.node.id,
        anchor: targetAnchor,
        point: targetPoint
      }
    }
  }

  const getEdgeConnectFromPoint: WhiteboardInstanceQuery['getEdgeConnectFromPoint'] = (from) => {
    if (!from) return undefined
    const entry = getCanvasNodeRectById(from.nodeId)
    if (!entry) return undefined
    return getAnchorPoint(entry.rect, from.anchor, entry.rotation)
  }

  const getEdgeConnectToPoint: WhiteboardInstanceQuery['getEdgeConnectToPoint'] = (to) => {
    if (!to) return undefined
    if (to.nodeId && to.anchor) {
      const entry = getCanvasNodeRectById(to.nodeId)
      if (!entry) return to.pointWorld
      return getAnchorPoint(entry.rect, to.anchor, entry.rotation)
    }
    return to.pointWorld
  }

  const getEdgePathEntry: WhiteboardInstanceQuery['getEdgePathEntry'] = (edge) => {
    const endpoints = getEdgeResolvedEndpoints(edge)
    if (!endpoints) return undefined

    const path = getEdgePath({
      edge,
      source: { point: endpoints.source.point, side: endpoints.source.anchor.side },
      target: { point: endpoints.target.point, side: endpoints.target.anchor.side }
    })

    return {
      id: edge.id,
      edge,
      path
    }
  }

  const getNearestEdgeSegmentIndexAtWorld: WhiteboardInstanceQuery['getNearestEdgeSegmentIndexAtWorld'] = (
    pointWorld,
    pathPoints
  ) => {
    if (pathPoints.length < 2) return 0

    let min = Number.POSITIVE_INFINITY
    let minIndex = Math.max(0, pathPoints.length - 2)

    for (let i = 0; i < pathPoints.length - 1; i += 1) {
      const distance = distancePointToSegment(pointWorld, pathPoints[i], pathPoints[i + 1])
      if (distance < min) {
        min = distance
        minIndex = i
      }
    }

    return minIndex
  }

  const getShortcutContext: WhiteboardInstanceQuery['getShortcutContext'] = (event?: ShortcutNativeEvent) => {
    const interaction = readState('interaction')
    const tool = readState('tool')
    const selection = readState('selection')
    const selectedEdgeId = readState('edgeSelection')
    const edgeConnect = readState('edgeConnect')
    const selectedNodeIds = Array.from(selection.selectedNodeIds)

    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    const isEditingTarget = isEditableElement(event?.target ?? null)
    const isInputFocused = isEditableElement(activeElement)
    const isImeComposing =
      typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent ? event.isComposing : false

    const modifiers = event
      ? {
          alt: event.altKey ?? false,
          shift: event.shiftKey ?? false,
          ctrl: event.ctrlKey ?? false,
          meta: event.metaKey ?? false
        }
      : interaction.pointer.modifiers

    const button =
      typeof PointerEvent !== 'undefined' && event instanceof PointerEvent
        ? (event.button as 0 | 1 | 2)
        : interaction.pointer.button

    return {
      platform,
      focus: event
        ? {
            isEditingText: isEditingTarget,
            isInputFocused,
            isImeComposing
          }
        : interaction.focus,
      tool: { active: tool },
      selection: {
        count: selectedNodeIds.length,
        hasSelection: selectedNodeIds.length > 0,
        selectedNodeIds,
        selectedEdgeId
      },
      hover: interaction.hover,
      pointer: {
        ...interaction.pointer,
        button,
        modifiers,
        isDragging: interaction.pointer.isDragging || selection.isSelecting || edgeConnect.isConnecting
      },
      viewport: {
        zoom: getViewportZoom()
      }
    }
  }

  const getAnchorFromPointWithConfig: WhiteboardInstanceQuery['getAnchorFromPoint'] = (rect, rotation, point) =>
    getAnchorFromPoint(rect, rotation, point, {
      snapMin: config.edge.anchorSnapMin,
      snapRatio: config.edge.anchorSnapRatio
    })

  return {
    getCanvasNodeRects,
    getCanvasNodeRectById,
    getNodeIdsInRect,
    getSnapCandidates,
    getSnapCandidatesInRect,
    isCanvasBackgroundTarget,
    getAnchorFromPoint: getAnchorFromPointWithConfig,
    getEdgeConnectFromPoint,
    getEdgeConnectToPoint,
    getEdgeResolvedEndpoints,
    getEdgePathEntry,
    getNearestEdgeSegmentIndexAtWorld,
    getShortcutContext
  }
}
