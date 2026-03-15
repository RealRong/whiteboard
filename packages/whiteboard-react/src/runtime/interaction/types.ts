import type { ReadStore } from '@whiteboard/core/runtime'

export type InteractionMode =
  | 'idle'
  | 'viewport-gesture'
  | 'selection-box'
  | 'node-drag'
  | 'mindmap-drag'
  | 'node-transform'
  | 'edge-connect'
  | 'edge-routing'

export type ActiveInteractionMode = Exclude<InteractionMode, 'idle'>

export type InteractionSpec = Readonly<{
  menu: 'allow' | 'block'
  viewport: 'allow' | 'block'
  pan: 'none' | 'viewport'
}>

export type InteractionToken = Readonly<{
  id: number
}>

export type ActiveInteraction = Readonly<{
  token: InteractionToken
  mode: ActiveInteractionMode
  cancel: () => void
  pointerId?: number
  spec: InteractionSpec
}>

export type InteractionCoordinator = {
  mode: ReadStore<InteractionMode>
  current: () => ActiveInteraction | null
  tryStart: (
    input: {
      mode: ActiveInteractionMode
      cancel: () => void
      pointerId?: number
    }
  ) => InteractionToken | null
  finish: (token: InteractionToken) => void
  cancel: () => void
}
