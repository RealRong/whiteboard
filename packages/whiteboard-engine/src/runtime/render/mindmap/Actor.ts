import type { Render } from '@engine-types/instance/render'
import type {
  MindmapDragState,
  MindmapRootDragState,
  MindmapSubtreeDragState
} from '@engine-types/state'

type MindmapRender = Pick<Render, 'read' | 'write'>

type MindmapDragPayload = MindmapRootDragState | MindmapSubtreeDragState

export class Actor {
  private readonly render: MindmapRender

  constructor(render: MindmapRender) {
    this.render = render
  }

  getDrag = () => this.render.read('mindmapDrag').payload

  setDrag = (
    next: MindmapDragState | ((prev: MindmapDragState) => MindmapDragState)
  ) => {
    this.render.write('mindmapDrag', next)
  }

  setDragPayload = (payload: MindmapDragPayload | null) => {
    this.render.write('mindmapDrag', payload === null ? {} : { payload })
  }

  clearDrag = () => {
    this.render.write('mindmapDrag', {})
  }
}
