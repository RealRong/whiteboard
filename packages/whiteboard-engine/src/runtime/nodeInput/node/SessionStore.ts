import type { Node, NodeId, Point } from '@whiteboard/core/types'

export type DragChildren = {
  ids: NodeId[]
  offsets: Map<NodeId, Point>
}

export type NodeDragSession = {
  pointerId: number
  nodeId: NodeId
  nodeType: Node['type']
  start: Point
  origin: Point
  last: Point
  size: { width: number; height: number }
  children?: DragChildren
}

export class SessionStore {
  private session: NodeDragSession | null = null

  read = (pointerId?: number): NodeDragSession | undefined => {
    const active = this.session
    if (!active) return undefined
    if (pointerId !== undefined && active.pointerId !== pointerId) {
      return undefined
    }
    return active
  }

  begin = (session: NodeDragSession) => {
    this.session = session
  }

  updateLast = (position: Point) => {
    if (!this.session) return
    this.session.last = position
  }

  clear = () => {
    this.session = null
  }
}
