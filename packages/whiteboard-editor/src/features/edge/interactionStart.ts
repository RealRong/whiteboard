import type { PointerStart } from '../../runtime/input/pointer'

type EdgeToolInteractionStart = PointerStart & {
  tool: Extract<PointerStart['tool'], {
    type: 'edge'
  }>
}

type SelectEdgeInteractionStart = PointerStart & {
  tool: Extract<PointerStart['tool'], {
    type: 'select'
  }>
  pick: Extract<PointerStart['pick'], {
    kind: 'edge'
  }>
}

export const isEdgeCreateInteractionStart = (
  start: PointerStart
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
  start: PointerStart
): start is SelectEdgeInteractionStart => (
  start.tool.type === 'select'
  && start.pick.kind === 'edge'
)
