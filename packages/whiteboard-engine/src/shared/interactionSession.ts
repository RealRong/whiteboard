import type { Render } from '@engine-types/instance/render'
import type { InteractionSessionKind } from '@engine-types/state'

type InteractionRender = Pick<Render, 'write'>

export const writeInteractionSession = (
  render: InteractionRender,
  kind: InteractionSessionKind,
  pointerId: number | null
) => {
  render.write('interactionSession', (prev) => {
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

export const clearInteractionKinds = (
  render: InteractionRender,
  kinds: readonly InteractionSessionKind[]
) => {
  render.write('interactionSession', (prev) => {
    if (!prev.active) return prev
    if (!kinds.includes(prev.active.kind)) {
      return prev
    }
    return {}
  })
}
