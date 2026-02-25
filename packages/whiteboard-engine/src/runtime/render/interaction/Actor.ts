import type { Render } from '@engine-types/instance/render'
import type { InteractionSessionKind } from '@engine-types/state'

type InteractionRender = Pick<Render, 'read' | 'write'>

export class Actor {
  private readonly render: InteractionRender

  constructor(render: InteractionRender) {
    this.render = render
  }

  getActive = () => this.render.read('interactionSession').active

  set = (kind: InteractionSessionKind, pointerId: number | null) => {
    this.render.write('interactionSession', (prev) => {
      if (pointerId === null) {
        if (prev.active?.kind !== kind) return prev
        return {}
      }
      if (
        prev.active?.kind === kind
        && prev.active.pointerId === pointerId
      ) {
        return prev
      }
      return {
        active: {
          kind,
          pointerId
        }
      }
    })
  }

  clearKinds = (kinds: readonly InteractionSessionKind[]) => {
    this.render.write('interactionSession', (prev) => {
      if (!prev.active) return prev
      if (!kinds.includes(prev.active.kind)) return prev
      return {}
    })
  }

  clear = () => {
    this.render.write('interactionSession', {})
  }
}
