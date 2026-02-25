import type { Render } from '@engine-types/instance/render'
import type { Guide } from '@engine-types/node/snap'
import type {
  GroupHoverState,
  NodeDragPayload,
  NodePreviewUpdate,
  NodeTransformPayload
} from '@engine-types/state'

type NodeRender = Pick<Render, 'read' | 'write' | 'batch'>

export class Actor {
  private readonly render: NodeRender

  constructor(render: NodeRender) {
    this.render = render
  }

  getDrag = () => this.render.read('nodeDrag').payload

  setDrag = (payload: NodeDragPayload | null) => {
    this.render.write('nodeDrag', payload === null ? {} : { payload })
  }

  setTransform = (payload: NodeTransformPayload | null) => {
    this.render.write('nodeTransform', payload === null ? {} : { payload })
  }

  setPreview = (updates: NodePreviewUpdate[]) => {
    this.render.write('nodePreview', { updates })
  }

  setGuides = (guides: Guide[]) => {
    this.render.write('dragGuides', guides)
  }

  setGroupHover = (
    next: GroupHoverState | ((prev: GroupHoverState) => GroupHoverState)
  ) => {
    this.render.write('groupHover', next)
  }

  clearTransient = () => {
    this.render.batch(() => {
      this.render.write('nodeDrag', {})
      this.render.write('nodeTransform', {})
      this.render.write('nodePreview', { updates: [] })
      this.render.write('dragGuides', [])
      this.render.write('groupHover', {})
    })
  }
}
