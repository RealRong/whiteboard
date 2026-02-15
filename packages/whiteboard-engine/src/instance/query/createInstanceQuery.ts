import { getEdgePath } from '@whiteboard/core'
import type {
  WhiteboardEdgePathEntry,
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardStateNamespace
} from '@engine-types/instance'
import type { EdgeConnectState } from '@engine-types/state'
import type { ShortcutContext, ShortcutNativeEvent } from '@engine-types/shortcuts'
import { toEdgePathSignature, toNodeGeometrySignature } from '../../infra/cache'
import {
  getAnchorPoint,
  getNodeAABB,
  getNodeRect,
  getRectCenter
} from '../../infra/geometry'
import {
  getAnchorFromPoint,
  getAutoAnchorFromRect,
  getNearestEdgeSegmentIndexAtWorld as getNearestEdgeSegmentIndexAtWorldQuery,
  getNodeIdsInRect as getNodeIdsInRectByEntries,
  isCanvasBackgroundTarget as isCanvasBackgroundTargetQuery
} from '../../infra/query'
import { buildSnapCandidates, createGridIndex, queryGridIndex } from '../../node/utils/snap'

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
    getNodeIdsInRectByEntries(rect, getCanvasNodeRects())

  const getSnapCandidates: WhiteboardInstanceQuery['getSnapCandidates'] = () => {
    ensureSnapCache()
    return cachedSnapCandidates
  }

  const getSnapCandidatesInRect: WhiteboardInstanceQuery['getSnapCandidatesInRect'] = (rect) => {
    ensureSnapCache()
    return queryGridIndex(cachedSnapIndex, rect)
  }

  const isCanvasBackgroundTarget: WhiteboardInstanceQuery['isCanvasBackgroundTarget'] = (target) => {
    return isCanvasBackgroundTargetQuery({
      container: getContainer(),
      target
    })
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

  type EdgeConnectFrom = NonNullable<EdgeConnectState['from']>
  type EdgeConnectTo = NonNullable<EdgeConnectState['to']>

  type EdgeConnectPointInput = {
    nodeId?: EdgeConnectFrom['nodeId']
    anchor?: EdgeConnectFrom['anchor']
    pointWorld?: EdgeConnectTo['pointWorld']
  }

  const resolveEdgeConnectPoint = (
    value: EdgeConnectPointInput | undefined,
    options: {
      allowPointWorld: boolean
      getCachedEntry: (nodeId: EdgeConnectFrom['nodeId']) => ReturnType<typeof getCanvasNodeRectById>
    }
  ) => {
    if (!value) return undefined
    if (value.nodeId && value.anchor) {
      const entry = options.getCachedEntry(value.nodeId)
      if (entry) {
        return getAnchorPoint(entry.rect, value.anchor, entry.rotation)
      }
      if (!options.allowPointWorld) return undefined
    }
    if (!options.allowPointWorld) return undefined
    return value.pointWorld
  }

  const getEdgeConnectPreview: WhiteboardInstanceQuery['getEdgeConnectPreview'] = (edgeConnect) => {
    const nodeRectCache = new Map<EdgeConnectFrom['nodeId'], ReturnType<typeof getCanvasNodeRectById> | null>()
    const getCachedEntry = (nodeId: EdgeConnectFrom['nodeId']) => {
      const cached = nodeRectCache.get(nodeId)
      if (cached !== undefined) return cached ?? undefined
      const entry = getCanvasNodeRectById(nodeId)
      nodeRectCache.set(nodeId, entry ?? null)
      return entry
    }
    const isPreviewLineMode = edgeConnect.isConnecting && !edgeConnect.reconnect

    const from = isPreviewLineMode
      ? resolveEdgeConnectPoint(edgeConnect.from, { allowPointWorld: false, getCachedEntry })
      : undefined
    const to = isPreviewLineMode
      ? resolveEdgeConnectPoint(edgeConnect.to, { allowPointWorld: true, getCachedEntry })
      : undefined
    const hover = resolveEdgeConnectPoint(edgeConnect.hover, { allowPointWorld: true, getCachedEntry })

    return {
      from,
      to,
      hover,
      reconnect: edgeConnect.reconnect,
      showPreviewLine: Boolean(isPreviewLineMode && from && to)
    }
  }

  type EdgePathCacheEntry = {
    geometrySignature: string
    edge: WhiteboardEdgePathEntry['edge']
    path: WhiteboardEdgePathEntry['path']
    entry: WhiteboardEdgePathEntry
  }

  const getNodeGeometrySignature = (nodeId: WhiteboardEdgePathEntry['edge']['source']['nodeId']) =>
    toNodeGeometrySignature(getCanvasNodeRectById(nodeId))

  const getEdgeGeometrySignature = (edge: WhiteboardEdgePathEntry['edge']) =>
    toEdgePathSignature(edge, getNodeGeometrySignature)

  const toEdgePathCacheEntry = (
    edge: WhiteboardEdgePathEntry['edge'],
    previous?: EdgePathCacheEntry
  ): EdgePathCacheEntry | undefined => {
    const geometrySignature = getEdgeGeometrySignature(edge)
    if (previous?.geometrySignature === geometrySignature) {
      if (previous.edge === edge) return previous
      const entry = {
        ...previous.entry,
        edge
      }
      return {
        ...previous,
        edge,
        entry
      }
    }

    const endpoints = getEdgeResolvedEndpoints(edge)
    if (!endpoints) return undefined

    const path = getEdgePath({
      edge,
      source: { point: endpoints.source.point, side: endpoints.source.anchor.side },
      target: { point: endpoints.target.point, side: endpoints.target.anchor.side }
    })

    const entry = {
      id: edge.id,
      edge,
      path
    }

    return {
      geometrySignature,
      edge,
      path,
      entry
    }
  }

  const isSameEdgePathEntryList = (left: WhiteboardEdgePathEntry[], right: WhiteboardEdgePathEntry[]) => {
    if (left === right) return true
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return false
    }
    return true
  }

  let cachedEdgePathEntries: WhiteboardEdgePathEntry[] = []
  let cachedEdgePathEntryById = new Map<WhiteboardEdgePathEntry['id'], EdgePathCacheEntry>()
  let cachedRenderEdgesRef: unknown
  let cachedRenderNodesRef: unknown

  const ensureEdgePathEntries = () => {
    const edges = readState('visibleEdges')
    const nodes = readState('canvasNodes')
    if (edges === cachedRenderEdgesRef && nodes === cachedRenderNodesRef) return

    cachedRenderEdgesRef = edges
    cachedRenderNodesRef = nodes

    const previousMap = cachedEdgePathEntryById
    const nextMap = new Map<WhiteboardEdgePathEntry['id'], EdgePathCacheEntry>()
    const nextEntries: WhiteboardEdgePathEntry[] = []

    edges.forEach((edge) => {
      const nextEntry = toEdgePathCacheEntry(edge, previousMap.get(edge.id))
      if (!nextEntry) return
      nextMap.set(edge.id, nextEntry)
      nextEntries.push(nextEntry.entry)
    })

    cachedEdgePathEntryById = nextMap
    if (!isSameEdgePathEntryList(cachedEdgePathEntries, nextEntries)) {
      cachedEdgePathEntries = nextEntries
    }
  }

  const resolveReconnectPoint = (
    to: EdgeConnectState['to']
  ): {
    point: ReturnType<typeof getAnchorPoint>
    side?: NonNullable<WhiteboardEdgePathEntry['edge']['source']['anchor']>['side']
  } | undefined => {
    if (!to) return undefined
    if (to.nodeId && to.anchor) {
      const entry = getCanvasNodeRectById(to.nodeId)
      if (entry) {
        return {
          point: getAnchorPoint(entry.rect, to.anchor, entry.rotation),
          side: to.anchor.side
        }
      }
    }
    if (!to.pointWorld) return undefined
    return {
      point: to.pointWorld,
      side: to.anchor?.side
    }
  }

  const getReconnectEdgePathEntry = (edgeConnect: EdgeConnectState): WhiteboardEdgePathEntry | undefined => {
    if (!edgeConnect.isConnecting || !edgeConnect.reconnect) return undefined
    const reconnectBase = cachedEdgePathEntryById.get(edgeConnect.reconnect.edgeId)?.entry
    if (!reconnectBase) return undefined

    const moved = resolveReconnectPoint(edgeConnect.to)
    if (!moved) return undefined

    const endpoints = getEdgeResolvedEndpoints(reconnectBase.edge)
    if (!endpoints) return undefined

    let source = { point: endpoints.source.point, side: endpoints.source.anchor.side }
    let target = { point: endpoints.target.point, side: endpoints.target.anchor.side }

    if (edgeConnect.reconnect.end === 'source') {
      source = {
        point: moved.point,
        side: moved.side ?? source.side
      }
    } else {
      target = {
        point: moved.point,
        side: moved.side ?? target.side
      }
    }

    return {
      ...reconnectBase,
      path: getEdgePath({
        edge: reconnectBase.edge,
        source,
        target
      })
    }
  }

  const getEdgePathEntries: WhiteboardInstanceQuery['getEdgePathEntries'] = () => {
    ensureEdgePathEntries()
    return cachedEdgePathEntries
  }

  const getEdgeReconnectPathEntry: WhiteboardInstanceQuery['getEdgeReconnectPathEntry'] = (edgeConnect) => {
    ensureEdgePathEntries()
    return getReconnectEdgePathEntry(edgeConnect)
  }

  const getNearestEdgeSegmentIndexAtWorld: WhiteboardInstanceQuery['getNearestEdgeSegmentIndexAtWorld'] = (
    pointWorld,
    pathPoints
  ) => getNearestEdgeSegmentIndexAtWorldQuery(pointWorld, pathPoints)

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
    getEdgeConnectPreview,
    getEdgePathEntries,
    getEdgeReconnectPathEntry,
    getEdgeResolvedEndpoints,
    getNearestEdgeSegmentIndexAtWorld,
    getShortcutContext
  }
}
