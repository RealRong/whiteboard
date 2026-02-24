import type { NodeId } from '@whiteboard/core/types'
import type { ResizeDragState, RotateDragState } from '@engine-types/node'

export type NodeTransformSession = {
  nodeId: NodeId
  drag: ResizeDragState | RotateDragState
}

export class SessionStore {
  private session: NodeTransformSession | null = null

  read = (pointerId?: number): NodeTransformSession | undefined => {
    const active = this.session
    if (!active) return undefined
    if (pointerId !== undefined && active.drag.pointerId !== pointerId) {
      return undefined
    }
    return active
  }

  begin = (session: NodeTransformSession) => {
    this.session = session
  }

  clear = () => {
    this.session = null
  }
}
