import type { ReadStore } from '@whiteboard/core/runtime'

export type InteractionMode =
  | 'idle'
  | 'selection-box'
  | 'node-drag'
  | 'mindmap-drag'
  | 'node-transform'
  | 'edge-connect'
  | 'edge-routing'

export type InteractionToken = Readonly<{
  kind: Exclude<InteractionMode, 'idle'>
}>

export type InteractionCoordinator = {
  mode: ReadStore<InteractionMode>
  tryStart: (
    kind: Exclude<InteractionMode, 'idle'>,
    cancel: () => void
  ) => InteractionToken | null
  finish: (token: InteractionToken) => void
  clear: () => void
}
