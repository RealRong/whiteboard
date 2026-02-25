import type { Render } from '@engine-types/instance/render'
import type { SelectionBoxState } from '@engine-types/state'

type SelectionRender = Pick<Render, 'write'>

export class Actor {
  private readonly render: SelectionRender

  constructor(render: SelectionRender) {
    this.render = render
  }

  setBox = (
    next: SelectionBoxState | ((prev: SelectionBoxState) => SelectionBoxState)
  ) => {
    this.render.write('selectionBox', next)
  }

  clearBox = () => {
    this.render.write('selectionBox', {
      isSelecting: false,
      selectionRect: undefined,
      selectionRectWorld: undefined
    })
  }
}
