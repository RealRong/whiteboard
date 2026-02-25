import type { Render } from '@engine-types/instance/render'
import type { Viewport } from '@whiteboard/core/types'

type ViewportRender = Pick<Render, 'read' | 'write'>

const copyViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

export class Actor {
  private readonly render: ViewportRender

  constructor(render: ViewportRender) {
    this.render = render
  }

  getPreview = () => this.render.read('viewportGesture').preview

  setPreview = (viewport: Viewport) => {
    this.render.write('viewportGesture', {
      preview: copyViewport(viewport)
    })
  }

  clearPreview = () => {
    this.render.write('viewportGesture', {})
  }
}
