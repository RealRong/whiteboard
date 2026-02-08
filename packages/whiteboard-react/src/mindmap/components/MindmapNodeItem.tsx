import type { PointerEvent } from 'react'
import type { MindmapNodeId, Rect } from '@whiteboard/core'
import { MindmapAddButton } from './MindmapAddButton'
import {
  MINDMAP_NODE_BASE_STYLE,
  MINDMAP_NODE_LABEL_STYLE,
  MINDMAP_NODE_TRANSITION
} from '../constants'

type MindmapNodeItemProps = {
  id: MindmapNodeId
  rect: Rect
  shiftX: number
  shiftY: number
  label: string
  dragActive: boolean
  attachTarget: boolean
  showActions: boolean
  dragPreviewActive: boolean
  onPointerDown: (event: PointerEvent<HTMLDivElement>, nodeId: MindmapNodeId) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void
  onAddChild: (nodeId: MindmapNodeId, placement: 'left' | 'right' | 'up' | 'down') => void
}

export const MindmapNodeItem = ({
  id,
  rect,
  shiftX,
  shiftY,
  label,
  dragActive,
  attachTarget,
  showActions,
  dragPreviewActive,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onAddChild
}: MindmapNodeItemProps) => {
  const border = attachTarget
    ? `calc(2px / var(--wb-zoom, 1)) solid #2563eb`
    : `calc(1px / var(--wb-zoom, 1)) solid #111`
  const transition = dragPreviewActive ? 'none' : MINDMAP_NODE_TRANSITION

  return (
    <div
      data-mindmap-node-id={id}
      data-drag-active={dragActive ? 'true' : undefined}
      data-drag-preview-active={dragPreviewActive ? 'true' : undefined}
      className="wb-mindmap-node-item"
      onPointerDown={(event) => onPointerDown(event, id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        ...MINDMAP_NODE_BASE_STYLE,
        left: 0,
        top: 0,
        width: rect.width,
        height: rect.height,
        border,
        opacity: dragActive ? 0.35 : 1,
        transition,
        transform: `translate(${rect.x + shiftX}px, ${rect.y + shiftY}px)`
      }}
    >
      <div style={MINDMAP_NODE_LABEL_STYLE}>{label}</div>
      {showActions && (
        <div className="wb-mindmap-node-actions" data-selection-ignore>
          <MindmapAddButton placement="up" onClick={() => onAddChild(id, 'up')} />
          <MindmapAddButton placement="down" onClick={() => onAddChild(id, 'down')} />
          <MindmapAddButton placement="left" onClick={() => onAddChild(id, 'left')} />
          <MindmapAddButton placement="right" onClick={() => onAddChild(id, 'right')} />
        </div>
      )}
    </div>
  )
}
