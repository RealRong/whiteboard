import type { CSSProperties, PointerEvent } from 'react'
import type { MindmapNodeId, Rect } from '@whiteboard/core'
import { MindmapAddButton } from './MindmapAddButton'
import {
  MINDMAP_NODE_ACTIVE_BORDER,
  MINDMAP_NODE_DEFAULT_BORDER,
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
  const transition = dragPreviewActive ? 'none' : MINDMAP_NODE_TRANSITION
  const borderWidth = attachTarget ? MINDMAP_NODE_ACTIVE_BORDER : MINDMAP_NODE_DEFAULT_BORDER

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
        '--wb-mindmap-node-w': `${rect.width}px`,
        '--wb-mindmap-node-h': `${rect.height}px`,
        '--wb-mindmap-node-border-w': borderWidth,
        '--wb-mindmap-node-opacity': dragActive ? 0.35 : 1,
        '--wb-mindmap-node-transition': transition,
        '--wb-mindmap-node-tx': `${rect.x + shiftX}px`,
        '--wb-mindmap-node-ty': `${rect.y + shiftY}px`,
        '--wb-mindmap-node-border-color': attachTarget ? '#2563eb' : '#111'
      } as CSSProperties}
      data-attach-target={attachTarget ? 'true' : undefined}
    >
      <div className="wb-mindmap-node-label">{label}</div>
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
