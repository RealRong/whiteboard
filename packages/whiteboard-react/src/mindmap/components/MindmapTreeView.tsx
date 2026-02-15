import { useCallback } from 'react'
import type { PointerEvent } from 'react'
import type { MindmapNodeId } from '@whiteboard/core'
import type { WhiteboardMindmapDragView, WhiteboardMindmapViewTree } from '@whiteboard/engine'
import { useInstance } from '../../common/hooks'
import { MindmapNodeItem } from './MindmapNodeItem'

type MindmapTreeViewProps = {
  item: WhiteboardMindmapViewTree
  drag?: WhiteboardMindmapDragView
}

export const MindmapTreeView = ({ item, drag }: MindmapTreeViewProps) => {
  const { tree, node: mindmapNode, computed, shiftX, shiftY, lines, labels, layout } = item
  const instance = useInstance()
  const nodeSize = instance.runtime.config.mindmapNodeSize
  const treeDrag = drag?.treeId === mindmapNode.id ? drag : undefined
  const dragPreview = treeDrag?.preview
  const baseOffset = treeDrag?.baseOffset ?? mindmapNode.position

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, nodeId: MindmapNodeId) => {
      if (event.button !== 0) return
      const handled = instance.commands.mindmap.startDrag({
        treeId: mindmapNode.id,
        nodeId,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
      if (!handled) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [instance.commands.mindmap, mindmapNode.id]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!instance.commands.mindmap.updateDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })) {
        return
      }
      event.preventDefault()
    },
    [instance.commands.mindmap]
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!instance.commands.mindmap.endDrag({ pointerId: event.pointerId })) return
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    [instance.commands.mindmap]
  )

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!instance.commands.mindmap.cancelDrag({ pointerId: event.pointerId })) return
      event.preventDefault()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    [instance.commands.mindmap]
  )

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
        const label = labels[id] ?? 'mindmap'
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
