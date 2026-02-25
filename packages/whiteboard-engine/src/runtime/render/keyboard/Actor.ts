import type { Render } from '@engine-types/instance/render'

type KeyboardRender = Pick<Render, 'read' | 'write'>

export class Actor {
  private readonly render: KeyboardRender

  constructor(render: KeyboardRender) {
    this.render = render
  }

  getSpacePressed = () => this.render.read('spacePressed')

  setSpacePressed = (pressed: boolean) => {
    this.render.write('spacePressed', pressed)
  }
}
