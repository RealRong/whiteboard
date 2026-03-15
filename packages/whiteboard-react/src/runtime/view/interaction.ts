import type { InternalWhiteboardInstance } from '../instance'
import type { InteractionSession } from '../interaction/types'

export type InteractionMode =
  | 'idle'
  | 'selection-box'
  | 'node-drag'
  | 'mindmap-drag'
  | 'node-transform'
  | 'edge-connect'
  | 'edge-routing'

export type InteractionView = {
  mode: InteractionMode
}

const resolveInteractionMode = ({
  session
}: {
  session: InteractionSession
}): InteractionMode => {
  if (session.kind === 'edge-connect') return 'edge-connect'
  if (session.kind === 'edge-routing') return 'edge-routing'
  if (session.kind === 'selection-box') return 'selection-box'
  if (session.kind === 'node-transform') return 'node-transform'
  if (session.kind === 'mindmap-drag') return 'mindmap-drag'
  if (session.kind === 'node-drag') return 'node-drag'
  return 'idle'
}

const resolveInteractionView = ({
  session
}: {
  session: InteractionSession
}): InteractionView => {
  const mode = resolveInteractionMode({ session })

  return {
    mode
  }
}

export const readInteractionView = (
  instance: Pick<InternalWhiteboardInstance, 'interaction'>
): InteractionView => resolveInteractionView({
  session: instance.interaction.session.get()
})

export const isInteractionViewEqual = (
  left: InteractionView,
  right: InteractionView
) => (
  left.mode === right.mode
)
