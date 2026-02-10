import { getEdgePath } from '@whiteboard/core'
import type { Store, WhiteboardInstanceConfig, WhiteboardInstanceQuery } from 'types/instance'
import {
  canvasNodesAtom,
  edgeConnectAtom,
  edgeSelectionAtom,
  interactionAtom,
  nodeSelectionAtom,
  platformAtom,
  toolAtom
} from '../../state'
import {
  getAnchorPoint,
  getNodeAABB,
  getNodeRect,
  getRectCenter,
  rectContainsRotatedRect,
  rectIntersectsRotatedRect
} from '../../utils/geometry'
import { getAnchorFromPoint, getAutoAnchorFromRect } from '../edge/edgeConnectUtils'

type CreateInstanceQueryOptions = {
  store: Store
  config: WhiteboardInstanceConfig
  getViewportZoom: () => number
  getContainer: () => HTMLDivElement | null
}

export const createInstanceQuery = ({
  store,
  config,
  getViewportZoom,
  getContainer
}: CreateInstanceQueryOptions): WhiteboardInstanceQuery => {
  let cachedNodes = store.get(canvasNodesAtom)
  let cachedRects = cachedNodes.map((node) => ({
    node,
    rect: getNodeRect(node, config.nodeSize),
    aabb: getNodeAABB(node, config.nodeSize),
    rotation: typeof node.rotation === 'number' ? node.rotation : 0
  }))
  let cachedById = new Map(cachedRects.map((entry) => [entry.node.id, entry]))

  const getCanvasNodeRects: WhiteboardInstanceQuery['getCanvasNodeRects'] = () => {
    const nodes = store.get(canvasNodesAtom)
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

  const getShortcutContext: WhiteboardInstanceQuery['getShortcutContext'] = () => {
    const platform = store.get(platformAtom)
    const interaction = store.get(interactionAtom)
    const tool = store.get(toolAtom)
    const selection = store.get(nodeSelectionAtom)
    const selectedEdgeId = store.get(edgeSelectionAtom)
    const edgeConnect = store.get(edgeConnectAtom)
    const selectedNodeIds = Array.from(selection.selectedNodeIds)

    return {
      platform,
      focus: interaction.focus,
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
        isDragging: interaction.pointer.isDragging || selection.isSelecting || edgeConnect.isConnecting
      },
      viewport: {
        zoom: getViewportZoom()
      }
    }
  }

  return {
    getCanvasNodeRects,
    getCanvasNodeRectById,
    getNodeIdsInRect,
    isCanvasBackgroundTarget,
    getAnchorFromPoint,
    getEdgeConnectFromPoint,
    getEdgeConnectToPoint,
    getEdgeResolvedEndpoints,
    getEdgePathEntry,
    getShortcutContext
  }
}
