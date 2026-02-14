import { useCallback, useMemo } from 'react'
import type { PointerEvent } from 'react'
import type { MindmapNodeId, MindmapTree, Node, Rect } from '@whiteboard/core'
import type { MindmapLayoutConfig } from 'types/mindmap'
import type { Size } from 'types/common'
import { useInstance } from '../../common/hooks'
import { useMindmapLayout } from '../hooks/useMindmapLayout'
import { useMindmapRootDrag } from '../hooks/useMindmapRootDrag'
import { useMindmapSubtreeDrag } from '../hooks/useMindmapSubtreeDrag'
import { computeStaticConnectionLine, getMindmapLabel } from '../utils/mindmapRender'
import { MindmapNodeItem } from './MindmapNodeItem'

type MindmapTreeViewProps = {
  tree: MindmapTree
  mindmapNode: Node
  nodeSize: Size
  layout: MindmapLayoutConfig
}

export const MindmapTreeView = ({
  tree,
  mindmapNode,
  nodeSize,
  layout
}: MindmapTreeViewProps) => {
  const instance = useInstance()
  const clientToScreen = instance.runtime.viewport.clientToScreen
  const screenToWorld = instance.runtime.viewport.screenToWorld
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
      return screenToWorld(clientToScreen(event.clientX, event.clientY))
    },
    [clientToScreen, screenToWorld]
  )

  const { baseOffset, startRootDrag, updateRootDrag, endRootDrag, cancelRootDrag } = useMindmapRootDrag({
    mindmapNode,
    getWorldPoint,
    commitRootPosition: (position) => {
      void instance.commands.mindmap.moveRoot({
        nodeId: mindmapNode.id,
        position
      })
    }
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
    moveSubtreeWithDrop: instance.commands.mindmap.moveSubtreeWithDrop,
    computeSubtreeDropTarget: instance.runtime.services.mindmapDrag.computeSubtreeDropTarget,
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
      await instance.commands.mindmap.insertNode({
        id: mindmapNode.id,
        tree,
        targetNodeId: nodeId,
        placement,
        nodeSize,
        layout,
        payload: { kind: 'text', text: '' }
      })
    },
    [instance.commands.mindmap, layout, mindmapNode.id, nodeSize, tree]
  )

  return (
    <div className="wb-mindmap-tree" style={{ transform: `translate(${baseOffset.x}px, ${baseOffset.y}px)` }}>
      <svg width={computed.bbox.width} height={computed.bbox.height} className="wb-mindmap-tree-canvas">
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
          <svg width={computed.bbox.width} height={computed.bbox.height} className="wb-mindmap-tree-canvas">
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
            className="wb-mindmap-tree-ghost"
            style={{
              width: dragPreview.ghost.width,
              height: dragPreview.ghost.height,
              transform: `translate(${dragPreview.ghost.x - baseOffset.x}px, ${dragPreview.ghost.y - baseOffset.y}px)`
            }}
          />
        </>
      )}
    </div>
  )
}
