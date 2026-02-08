import { useCallback, useMemo } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { Core, MindmapNodeId, MindmapTree, Node, Point, Rect } from '@whiteboard/core'
import { getSide } from '@whiteboard/core'
import type { MindmapLayoutConfig } from '../types'
import type { Size } from '../../common/types'
import { useMindmapLayout } from '../hooks/useMindmapLayout'
import { useMindmapRootDrag } from '../hooks/useMindmapRootDrag'
import { useMindmapSubtreeDrag } from '../hooks/useMindmapSubtreeDrag'
import { computeStaticConnectionLine, getMindmapLabel } from '../utils/mindmapRender'
import { MindmapNodeItem } from './MindmapNodeItem'

const MINDMAP_TREE_VIEW_STYLE = `
.wb-mindmap-node-item .wb-mindmap-node-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}
.wb-mindmap-node-item:hover .wb-mindmap-node-actions,
.wb-mindmap-node-item:focus-within .wb-mindmap-node-actions {
  opacity: 1;
  pointer-events: auto;
}
.wb-mindmap-node-item[data-drag-active='true'] .wb-mindmap-node-actions,
.wb-mindmap-node-item[data-drag-preview-active='true'] .wb-mindmap-node-actions {
  opacity: 0;
  pointer-events: none;
}
`

type MindmapTreeViewProps = {
  tree: MindmapTree
  mindmapNode: Node
  nodeSize: Size
  layout: MindmapLayoutConfig
  core: Core
  screenToWorld: (point: Point) => Point
  containerRef?: RefObject<HTMLElement | null>
}

export const MindmapTreeView = ({
  tree,
  mindmapNode,
  nodeSize,
  layout,
  core,
  screenToWorld,
  containerRef
}: MindmapTreeViewProps) => {
  const computed = useMindmapLayout({
    tree,
    nodeSize,
    mode: layout.mode,
    options: layout.options
  })

  const shiftX = -computed.bbox.x
  const shiftY = -computed.bbox.y

  const getWorldPoint = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const element = containerRef?.current
      if (element) {
        const rect = element.getBoundingClientRect()
        return screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      }
      return screenToWorld({ x: event.clientX, y: event.clientY })
    },
    [containerRef, screenToWorld]
  )

  const { baseOffset, startRootDrag, updateRootDrag, endRootDrag, cancelRootDrag } = useMindmapRootDrag({
    mindmapNode,
    core,
    getWorldPoint
  })

  const nodeRects = useMemo(() => {
    const map = new Map<MindmapNodeId, Rect>()
    Object.entries(computed.node).forEach(([id, rect]) => {
      map.set(id, {
        x: rect.x + shiftX + baseOffset.x,
        y: rect.y + shiftY + baseOffset.y,
        width: rect.width,
        height: rect.height
      })
    })
    return map
  }, [baseOffset.x, baseOffset.y, computed.node, shiftX, shiftY])

  const { dragPreview, startSubtreeDrag, updateSubtreeDrag, endSubtreeDrag, cancelSubtreeDrag } = useMindmapSubtreeDrag({
    tree,
    mindmapNode,
    nodeSize,
    layout,
    core,
    getWorldPoint,
    nodeRects
  })

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, nodeId: MindmapNodeId) => {
      if (event.button !== 0) return
      const rect = nodeRects.get(nodeId)
      if (!rect) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      if (nodeId === tree.rootId) {
        startRootDrag(event)
        return
      }
      startSubtreeDrag(event, nodeId, rect)
    },
    [nodeRects, startRootDrag, startSubtreeDrag, tree.rootId]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (updateRootDrag(event)) return
      updateSubtreeDrag(event)
    },
    [updateRootDrag, updateSubtreeDrag]
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (endRootDrag(event)) return
      endSubtreeDrag(event)
    },
    [endRootDrag, endSubtreeDrag]
  )

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (cancelRootDrag(event)) return
      cancelSubtreeDrag(event)
    },
    [cancelRootDrag, cancelSubtreeDrag]
  )

  const lines = useMemo(() => {
    const result: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = []
    Object.entries(tree.children).forEach(([parentId, childIds]) => {
      const parent = computed.node[parentId]
      if (!parent) return
      childIds.forEach((childId) => {
        const child = computed.node[childId]
        if (!child) return
        const side = parentId === tree.rootId ? tree.nodes[childId]?.side : undefined
        const { x1, y1, x2, y2 } = computeStaticConnectionLine(parent, child, side)
        result.push({ id: `${parentId}-${childId}`, x1, y1, x2, y2 })
      })
    })
    return result
  }, [computed.node, tree.children, tree.nodes, tree.rootId])

  const handleAddChild = useCallback(
    async (nodeId: MindmapNodeId, placement: 'left' | 'right' | 'up' | 'down') => {
      const payload = { kind: 'text', text: '' } as const
      const layoutHint = {
        nodeSize,
        mode: layout.mode,
        options: layout.options,
        anchorId: nodeId
      }
      if (nodeId === tree.rootId) {
        const children = tree.children[nodeId] ?? []
        const index = placement === 'up' ? 0 : placement === 'down' ? children.length : undefined
        const side =
          placement === 'left'
            ? 'left'
            : placement === 'right'
              ? 'right'
              : (layout.options?.side === 'left' || layout.options?.side === 'right'
                  ? layout.options.side
                  : 'right')
        await core.dispatch({
          type: 'mindmap.addChild',
          id: mindmapNode.id,
          parentId: nodeId,
          payload,
          options: { index, side, layout: layoutHint }
        })
        return
      }

      if (placement === 'up' || placement === 'down') {
        await core.dispatch({
          type: 'mindmap.addSibling',
          id: mindmapNode.id,
          nodeId,
          position: placement === 'up' ? 'before' : 'after',
          payload,
          options: { layout: layoutHint }
        })
        return
      }

      const side = getSide(tree, nodeId) ?? 'right'
      const towardRoot = (placement === 'left' && side === 'right') || (placement === 'right' && side === 'left')

      if (towardRoot) {
        const result = await core.dispatch({
          type: 'mindmap.addSibling',
          id: mindmapNode.id,
          nodeId,
          position: 'before',
          payload,
          options: { layout: layoutHint }
        })
        if (result.ok && result.value) {
          await core.dispatch({
            type: 'mindmap.moveSubtree',
            id: mindmapNode.id,
            nodeId,
            newParentId: result.value as MindmapNodeId,
            options: {
              index: 0,
              layout: {
                nodeSize,
                mode: layout.mode,
                options: layout.options,
                anchorId: result.value as MindmapNodeId
              }
            }
          })
        }
        return
      }

      await core.dispatch({
        type: 'mindmap.addChild',
        id: mindmapNode.id,
        parentId: nodeId,
        payload,
        options: { layout: layoutHint }
      })
    },
    [core, layout.mode, layout.options, layout.options?.side, mindmapNode.id, nodeSize, tree]
  )

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'auto',
        transform: `translate(${baseOffset.x}px, ${baseOffset.y}px)`
      }}
    >
      <style>{MINDMAP_TREE_VIEW_STYLE}</style>
      <svg
        width={computed.bbox.width}
        height={computed.bbox.height}
        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        {lines.map((line) => (
          <line
            key={line.id}
            x1={line.x1 + shiftX}
            y1={line.y1 + shiftY}
            x2={line.x2 + shiftX}
            y2={line.y2 + shiftY}
            stroke="#2f2f33"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            style={{ transition: dragPreview ? 'none' : 'all 160ms ease' }}
          />
        ))}
      </svg>
      {Object.entries(computed.node).map(([id, rect]) => {
        const node = tree.nodes[id]
        const label = getMindmapLabel(node)
        const dragActive = dragPreview?.nodeId === id
        const attachTarget = dragPreview?.drop?.type === 'attach' && dragPreview.drop.targetId === id
        return (
          <MindmapNodeItem
            key={id}
            id={id}
            rect={rect}
            shiftX={shiftX}
            shiftY={shiftY}
            label={label}
            dragActive={dragActive}
            attachTarget={attachTarget}
            showActions={!dragPreview}
            dragPreviewActive={Boolean(dragPreview)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onAddChild={handleAddChild}
          />
        )
      })}
      {dragPreview && (
        <>
          <svg
            width={computed.bbox.width}
            height={computed.bbox.height}
            style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
          >
            {dragPreview.drop?.connectionLine && (
              <line
                x1={dragPreview.drop.connectionLine.x1 - baseOffset.x}
                y1={dragPreview.drop.connectionLine.y1 - baseOffset.y}
                x2={dragPreview.drop.connectionLine.x2 - baseOffset.x}
                y2={dragPreview.drop.connectionLine.y2 - baseOffset.y}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {dragPreview.drop?.insertLine && (
              <line
                x1={dragPreview.drop.insertLine.x1 - baseOffset.x}
                y1={dragPreview.drop.insertLine.y1 - baseOffset.y}
                x2={dragPreview.drop.insertLine.x2 - baseOffset.x}
                y2={dragPreview.drop.insertLine.y2 - baseOffset.y}
                stroke="#2563eb"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: dragPreview.ghost.width,
              height: dragPreview.ghost.height,
              borderRadius: 12,
              border: 'calc(1px / var(--wb-zoom, 1)) dashed #2563eb',
              background: 'rgba(59, 130, 246, 0.08)',
              pointerEvents: 'none',
              transform: `translate(${dragPreview.ghost.x - baseOffset.x}px, ${dragPreview.ghost.y - baseOffset.y}px)`
            }}
          />
        </>
      )}
    </div>
  )
}
