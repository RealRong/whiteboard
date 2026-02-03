import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Provider as JotaiProvider } from 'jotai'
import { createStore } from 'jotai/vanilla'
import type { DispatchResult, Edge, Node, NodeId, Point } from '@whiteboard/core'
import { enlargeBox } from '@whiteboard/core'
import { NodeLayer } from './node/components/NodeLayer'
import { SelectionLayer } from './node/components/SelectionLayer'
import { DragGuidesLayer } from './node/components/DragGuidesLayer'
import { EdgeLayer } from './edge/components/EdgeLayer'
import { EdgePreviewLayer } from './edge/components/EdgePreviewLayer'
import { EdgeControlPointHandles } from './edge/components/EdgeControlPointHandles'
import { EdgeEndpointHandles } from './edge/components/EdgeEndpointHandles'
import { useCore } from './common/hooks/useCore'
import { useViewport } from './common/hooks/useViewport'
import { useViewportControls } from './common/hooks/useViewportControls'
import { useSelection } from './node/hooks/useSelection'
import { useEdgeConnect } from './edge/hooks/useEdgeConnect'
import { NodeRegistryProvider } from './node/registry/nodeRegistry'
import { createDefaultNodeRegistry } from './node/registry/defaultNodes'
import type { WhiteboardProps } from './types'
import { DEFAULT_MINDMAP_NODE_SIZE, DEFAULT_NODE_SIZE, getAnchorPoint, getNodeAABB, getNodeRect } from './common/utils/geometry'
import { buildSnapCandidates, createGridIndex, queryGridIndex, type Guide } from './node/utils/snap'
import {
  expandGroupRect,
  getCollapsedGroupIds,
  getGroupDescendants,
  getNodesBoundingRect,
  isNodeHiddenByCollapsedGroup,
  rectEquals
} from './node/utils/group'

const DEFAULT_GROUP_PADDING = 24

const WhiteboardInner = ({
  doc,
  onDocChange,
  core: externalCore,
  nodeRegistry,
  onSelectionChange,
  onEdgeSelectionChange,
  className,
  style,
  nodeSize = DEFAULT_NODE_SIZE,
  mindmapNodeSize = DEFAULT_MINDMAP_NODE_SIZE,
  mindmapLayout = {},
  viewport: viewportConfig = {},
  tool = 'select'
}: WhiteboardProps) => {
  const { core } = useCore({ doc, onDocChange, core: externalCore })
  const registry = useMemo(() => nodeRegistry ?? createDefaultNodeRegistry(), [nodeRegistry])
  const containerRef = useRef<HTMLDivElement>(null)
  const { viewport, transformStyle, screenToWorld } = useViewport(doc.viewport, containerRef)
  const [dragGuides, setDragGuides] = useState<Guide[]>([])
  const [hoverGroupId, setHoverGroupId] = useState<NodeId | undefined>(undefined)
  const nodeMap = useMemo(() => new Map(doc.nodes.map((node) => [node.id, node])), [doc.nodes])
  const collapsedGroupIds = useMemo(() => getCollapsedGroupIds(doc.nodes), [doc.nodes])
  const hiddenNodeIds = useMemo(() => {
    const set = new Set<NodeId>()
    doc.nodes.forEach((node) => {
      if (isNodeHiddenByCollapsedGroup(node, nodeMap, collapsedGroupIds)) {
        set.add(node.id)
      }
    })
    return set
  }, [collapsedGroupIds, doc.nodes, nodeMap])
  const visibleNodes = useMemo(
    () => doc.nodes.filter((node) => !hiddenNodeIds.has(node.id)),
    [doc.nodes, hiddenNodeIds]
  )
  const mindmapNodes = useMemo(() => visibleNodes.filter((node) => node.type === 'mindmap'), [visibleNodes])
  const canvasNodes = useMemo(() => visibleNodes.filter((node) => node.type !== 'mindmap'), [visibleNodes])
  const canvasNodeIds = useMemo(() => new Set(canvasNodes.map((node) => node.id)), [canvasNodes])
  const visibleEdges = useMemo(
    () => doc.edges.filter((edge) => canvasNodeIds.has(edge.source.nodeId) && canvasNodeIds.has(edge.target.nodeId)),
    [doc.edges, canvasNodeIds]
  )

  const selection = useSelection({
    containerRef,
    screenToWorld,
    nodes: canvasNodes,
    nodeSize,
    enabled: tool !== 'edge'
  })
  const edgeConnect = useEdgeConnect({
    core,
    nodes: canvasNodes,
    edges: visibleEdges,
    nodeSize,
    zoom: viewport.zoom,
    screenToWorld,
    containerRef,
    tool
  })

  const handleInsertEdgePoint = useCallback(
    (edge: Edge, pathPoints: Point[], segmentIndex: number, pointWorld: Point) => {
      if (edge.type === 'bezier' || edge.type === 'curve') return
      const basePoints = edge.routing?.points?.length ? edge.routing.points : pathPoints.slice(1, -1)
      const insertIndex = Math.max(0, Math.min(segmentIndex, basePoints.length))
      const nextPoints = [...basePoints]
      nextPoints.splice(insertIndex, 0, pointWorld)
      core.dispatch({
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'manual',
            points: nextPoints
          }
        }
      })
    },
    [core]
  )

  const snapCandidates = useMemo(() => {
    return buildSnapCandidates(
      canvasNodes.map((node) => ({
        id: node.id,
        rect: getNodeAABB(node, nodeSize)
      }))
    )
  }, [nodeSize, canvasNodes])
  const snapIndex = useMemo(() => createGridIndex(snapCandidates, 240), [snapCandidates])
  const selectionIds = useMemo(() => Array.from(selection.selectedNodeIds), [selection.selectedNodeIds])
  useEffect(() => {
    onSelectionChange?.(selectionIds)
  }, [onSelectionChange, selectionIds])
  useEffect(() => {
    onEdgeSelectionChange?.(edgeConnect.state.selectedEdgeId)
  }, [edgeConnect.state.selectedEdgeId, onEdgeSelectionChange])
  const viewportHandlers = useViewportControls({
    core,
    viewport,
    screenToWorld,
    containerRef,
    minZoom: viewportConfig.minZoom,
    maxZoom: viewportConfig.maxZoom,
    enablePan: viewportConfig.enablePan,
    enableWheel: viewportConfig.enableWheel
  })
  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #f7f7f8 0%, #ffffff 60%)',
    touchAction: 'none',
    userSelect: 'none',
    ...style
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    viewportHandlers.onPointerDown(event)
    selection.handlers?.onPointerDown(event)
    if (event.target === containerRef.current) {
      edgeConnect.selectEdge(undefined)
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    viewportHandlers.onPointerMove(event)
    selection.handlers?.onPointerMove(event)
    if (tool === 'edge' && screenToWorld && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      edgeConnect.updateHover(screenToWorld(point))
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    viewportHandlers.onPointerUp(event)
    selection.handlers?.onPointerUp(event)
  }

  useEffect(() => {
    if (!doc.nodes.length) return
    doc.nodes.forEach((group) => {
      if (group.type !== 'group') return
      const autoFit =
        group.data && typeof group.data.autoFit === 'string' ? group.data.autoFit : 'expand-only'
      if (autoFit === 'manual') return
      const padding =
        group.data && typeof group.data.padding === 'number' ? group.data.padding : DEFAULT_GROUP_PADDING
      const children = getGroupDescendants(doc.nodes, group.id)
      if (!children.length) return
      const contentRect = getNodesBoundingRect(children, nodeSize)
      if (!contentRect) return
      const groupRect = getNodeAABB(group, nodeSize)
      const expanded = expandGroupRect(groupRect, contentRect, padding)
      if (!rectEquals(expanded, groupRect)) {
        core.dispatch({
          type: 'node.update',
          id: group.id,
          patch: {
            position: { x: expanded.x, y: expanded.y },
            size: { width: expanded.width, height: expanded.height }
          }
        })
      }
    })
  }, [core, doc.nodes, nodeSize])

  useEffect(() => {
    const shouldIgnore = (target: EventTarget | null) => {
      if (!target || !(target instanceof HTMLElement)) return false
      if (target.closest('input, textarea, select')) return true
      if (target.isContentEditable) return true
      return false
    }

    const extractGroupId = (result: DispatchResult) => {
      if (!result.ok) return undefined
      const op = result.changes.operations.find(
        (operation): operation is { type: 'node.create'; node: Node } =>
          operation.type === 'node.create' && operation.node.type === 'group'
      )
      return op?.node.id
    }

    const createGroupFromSelection = async () => {
      if (selectionIds.length < 2) return
      const nodes = doc.nodes.filter((node) => selectionIds.includes(node.id))
      if (nodes.length < 2) return
      const contentRect = getNodesBoundingRect(nodes, nodeSize)
      if (!contentRect) return
      const padding = DEFAULT_GROUP_PADDING
      const groupRect = enlargeBox(contentRect, padding)
      const createResult = await core.dispatch({
        type: 'node.create',
        payload: {
          type: 'group',
          position: { x: groupRect.x, y: groupRect.y },
          size: { width: groupRect.width, height: groupRect.height },
          data: {
            padding,
            autoFit: 'expand-only'
          }
        }
      })
      const groupId = extractGroupId(createResult)
      if (!groupId) return
      for (const node of nodes) {
        await core.dispatch({ type: 'node.update', id: node.id, patch: { parentId: groupId } })
      }
      selection.select([groupId], 'replace')
    }

    const ungroupSelection = async () => {
      const groups = doc.nodes.filter(
        (node) => node.type === 'group' && selectionIds.includes(node.id)
      )
      if (!groups.length) return
      for (const group of groups) {
        const children = doc.nodes.filter((node) => node.parentId === group.id)
        for (const child of children) {
          await core.dispatch({ type: 'node.update', id: child.id, patch: { parentId: undefined } })
        }
        await core.dispatch({ type: 'node.delete', ids: [group.id] })
      }
      selection.clear()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyG') return
      if (!(event.metaKey || event.ctrlKey)) return
      if (shouldIgnore(event.target)) return
      event.preventDefault()
      if (event.shiftKey) {
        void ungroupSelection()
        return
      }
      void createGroupFromSelection()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [core, doc.nodes, nodeSize, selection, selectionIds])

  const previewFrom = (() => {
    const from = edgeConnect.state.from
    if (!from) return undefined
    const node = doc.nodes.find((item) => item.id === from.nodeId)
    if (!node) return undefined
    const rect = getNodeRect(node, nodeSize)
    const rotation = typeof node.rotation === 'number' ? node.rotation : 0
    return getAnchorPoint(rect, from.anchor, rotation)
  })()

  const previewTo = (() => {
    const to = edgeConnect.state.to
    if (!to) return undefined
    if (to.nodeId && to.anchor) {
      const node = doc.nodes.find((item) => item.id === to.nodeId)
      if (!node) return to.pointWorld
      const rect = getNodeRect(node, nodeSize)
      const rotation = typeof node.rotation === 'number' ? node.rotation : 0
      return getAnchorPoint(rect, to.anchor, rotation)
    }
    return to.pointWorld
  })()

  const hoverSnap = (() => {
    const hover = edgeConnect.state.hover
    if (!hover) return undefined
    if (hover.nodeId && hover.anchor) {
      const node = doc.nodes.find((item) => item.id === hover.nodeId)
      if (!node) return hover.pointWorld
      const rect = getNodeRect(node, nodeSize)
      const rotation = typeof node.rotation === 'number' ? node.rotation : 0
      return getAnchorPoint(rect, hover.anchor, rotation)
    }
    return hover.pointWorld
  })()

  return (
    <NodeRegistryProvider registry={registry}>
      <div
        ref={containerRef}
        className={className}
        style={containerStyle}
        onPointerDownCapture={viewportHandlers.onPointerDownCapture}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={viewportHandlers.onWheel}
      >
        <div style={{ position: 'absolute', inset: 0, ...transformStyle }}>
          <EdgeLayer
            nodes={canvasNodes}
            edges={visibleEdges}
            nodeSize={nodeSize}
            zoom={viewport.zoom}
            containerRef={containerRef}
            screenToWorld={screenToWorld}
            selectedEdgeId={edgeConnect.state.selectedEdgeId}
            onSelectEdge={(id) => edgeConnect.selectEdge(id)}
            onInsertPoint={handleInsertEdgePoint}
            connectState={edgeConnect.state}
          />
          <DragGuidesLayer guides={dragGuides} />
          <EdgeEndpointHandles
            edges={visibleEdges}
            nodes={canvasNodes}
            nodeSize={nodeSize}
            selectedEdgeId={edgeConnect.state.selectedEdgeId}
            onStartReconnect={(edgeId, end, event) => {
              event.preventDefault()
              event.stopPropagation()
              edgeConnect.startReconnect(edgeId, end, event.pointerId)
            }}
          />
          <EdgeControlPointHandles
            core={core}
            edges={visibleEdges}
            selectedEdgeId={edgeConnect.state.selectedEdgeId}
            containerRef={containerRef}
            screenToWorld={screenToWorld}
          />
          <EdgePreviewLayer
            from={edgeConnect.state.isConnecting && !edgeConnect.state.reconnect ? previewFrom : undefined}
            to={edgeConnect.state.isConnecting && !edgeConnect.state.reconnect ? previewTo : undefined}
            snap={tool === 'edge' ? hoverSnap : undefined}
          />
          <NodeLayer
            nodes={canvasNodes}
            core={core}
            nodeSize={nodeSize}
            zoom={viewport.zoom}
            selection={tool === 'edge' ? undefined : selection}
            edgeConnect={edgeConnect}
            tool={tool}
            containerRef={containerRef}
            screenToWorld={screenToWorld}
            group={{
              nodes: canvasNodes,
              nodeSize,
              padding: DEFAULT_GROUP_PADDING,
              hoveredGroupId: hoverGroupId,
              onHoverGroupChange: setHoverGroupId
            }}
            mindmap={{
              nodes: mindmapNodes,
              nodeSize: mindmapNodeSize,
              layout: mindmapLayout,
              core,
              screenToWorld,
              containerRef
            }}
            snap={{
              enabled: tool === 'select',
              candidates: snapCandidates,
              getCandidates: (rect) => queryGridIndex(snapIndex, rect),
              thresholdScreen: 8,
              zoom: viewport.zoom,
              onGuidesChange: setDragGuides
            }}
          />
        </div>
        <SelectionLayer rect={tool === 'edge' ? undefined : selection.selectionRect} />
      </div>
    </NodeRegistryProvider>
  )
}

export const Whiteboard = (props: WhiteboardProps) => {
  const selectionStoreRef = useRef(createStore())
  return (
    <JotaiProvider store={selectionStoreRef.current}>
      <WhiteboardInner {...props} />
    </JotaiProvider>
  )
}
