import type { Render } from '@engine-types/instance/render'
import type { InteractionSessionKind } from '@engine-types/state'
import {
  clearInteractionKinds,
  writeInteractionSession
} from '../../../shared/interactionSession'

type InteractionRender = Pick<Render, 'read' | 'write'>

export class Actor {
  private readonly render: InteractionRender

  constructor(render: InteractionRender) {
    this.render = render
  }

  getActive = () => this.render.read('interactionSession').active

  set = (kind: InteractionSessionKind, pointerId: number | null) => {
    writeInteractionSession(this.render, kind, pointerId)
  }

  clearKinds = (kinds: readonly InteractionSessionKind[]) => {
    clearInteractionKinds(this.render, kinds)
  }

  clear = () => {
    this.render.write('interactionSession', {})
  }
}
