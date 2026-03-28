import type { InteractionStart } from '../../runtime/input/pointer'

type EdgeToolInteractionStart = InteractionStart & {
  tool: Extract<InteractionStart['tool'], {
    type: 'edge'
  }>
}

type SelectEdgeInteractionStart = InteractionStart & {
  tool: Extract<InteractionStart['tool'], {
    type: 'select'
  }>
  pick: Extract<InteractionStart['pick'], {
    kind: 'edge'
  }>
}

export const isEdgeCreateInteractionStart = (
  start: InteractionStart
): start is EdgeToolInteractionStart => (
  start.tool.type === 'edge'
  && (
    (
      start.pick.kind === 'node'
      && start.pick.part === 'connect'
      && Boolean(start.pick.side)
    )
    || (
      !start.editable
      && !start.ignoreInput
      && !start.ignoreSelection
    )
  )
)

export const isEdgeInteractionStart = (
  start: InteractionStart
): start is SelectEdgeInteractionStart => (
  start.tool.type === 'select'
  && start.pick.kind === 'edge'
)
