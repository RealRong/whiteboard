import type { ReadStore } from '@whiteboard/core/runtime'

export type InteractionSession =
  | { kind: 'idle' }
  | { kind: 'selection-box' }
  | { kind: 'node-drag' }
  | { kind: 'mindmap-drag' }
  | { kind: 'node-transform' }
  | { kind: 'edge-connect' }
  | { kind: 'edge-routing' }

export type ActiveInteractionSessionKind = Exclude<
  InteractionSession['kind'],
  'idle'
>

export type InteractionToken = Readonly<{
  kind: ActiveInteractionSessionKind
}>

export type InteractionCoordinator = {
  session: ReadStore<InteractionSession>
  tryStart: (
    kind: ActiveInteractionSessionKind,
    cancel: () => void
  ) => InteractionToken | null
  finish: (token: InteractionToken) => void
  clear: () => void
}
