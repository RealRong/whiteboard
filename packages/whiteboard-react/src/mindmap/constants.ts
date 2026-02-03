import type { CSSProperties } from 'react'

export const MINDMAP_NODE_BASE_STYLE: CSSProperties = {
  position: 'absolute',
  borderRadius: 12,
  background: '#fef7e8',
  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  color: '#2f2f33',
  userSelect: 'none'
}

export const MINDMAP_NODE_DEFAULT_BORDER = '1px solid #111'
export const MINDMAP_NODE_ACTIVE_BORDER = '2px solid #2563eb'
export const MINDMAP_NODE_TRANSITION = 'transform 160ms ease, opacity 160ms ease'

export const MINDMAP_NODE_LABEL_STYLE: CSSProperties = {
  padding: '0 12px',
  textAlign: 'center',
  pointerEvents: 'none'
}
