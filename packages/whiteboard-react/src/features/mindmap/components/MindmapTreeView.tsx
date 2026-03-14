import type { MindmapNodeId } from '@whiteboard/core/types'
import { MindmapNodeItem } from './MindmapNodeItem'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { MindmapTreeViewData } from '../hooks/useMindmapTreeView'

type MindmapTreeViewProps = {
  view: MindmapTreeViewData
  onNodePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => void
}

export const MindmapTreeView = ({
  view,
  onNodePointerDown
}: MindmapTreeViewProps) => {
  const {
    treeId,
    baseOffset,
    bbox,
    shiftX,
    shiftY,
    lines,
    nodes,
    ghost,
    connectionLine,
    insertLine,
    onAddChild
  } = view

  return (
    <div
      className="wb-mindmap-tree"
      data-mindmap-tree-id={treeId}
      style={{ transform: `translate(${baseOffset.x}px, ${baseOffset.y}px)` }}
    >
      <svg width={bbox.width} height={bbox.height} className="wb-mindmap-tree-canvas">
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
            style={{ transition: ghost ? 'none' : 'all 160ms ease' }}
          />
        ))}
      </svg>
      {nodes.map((node) => (
        <MindmapNodeItem
          key={node.id}
          id={node.id}
          rect={node.rect}
          shiftX={shiftX}
          shiftY={shiftY}
          label={node.label}
          dragActive={node.dragActive}
          attachTarget={node.attachTarget}
          showActions={node.showActions}
          dragPreviewActive={node.dragPreviewActive}
          onAddChild={onAddChild}
          onPointerDown={(event) => {
            onNodePointerDown(event, treeId, node.id)
          }}
        />
      ))}
      {ghost && (
        <>
          <svg width={bbox.width} height={bbox.height} className="wb-mindmap-tree-canvas">
            {connectionLine && (
              <line
                x1={connectionLine.x1 - baseOffset.x}
                y1={connectionLine.y1 - baseOffset.y}
                x2={connectionLine.x2 - baseOffset.x}
                y2={connectionLine.y2 - baseOffset.y}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {insertLine && (
              <line
                x1={insertLine.x1 - baseOffset.x}
                y1={insertLine.y1 - baseOffset.y}
                x2={insertLine.x2 - baseOffset.x}
                y2={insertLine.y2 - baseOffset.y}
                stroke="#2563eb"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          <div
            className="wb-mindmap-tree-ghost"
            style={{
              width: ghost.width,
              height: ghost.height,
              transform: `translate(${ghost.x - baseOffset.x}px, ${ghost.y - baseOffset.y}px)`
            }}
          />
        </>
      )}
    </div>
  )
}
