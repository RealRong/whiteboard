import type { Point } from '@whiteboard/core/types'
import type { DrawBrushKind } from '../../runtime/tool'

export type DrawSlot =
  | '1'
  | '2'
  | '3'

export type BrushStyle = Readonly<{
  color: string
  width: number
}>

export type BrushStylePatch = Partial<BrushStyle>

export type DrawBrush = Readonly<{
  slot: DrawSlot
  slots: Readonly<Record<DrawSlot, BrushStyle>>
}>

export type DrawState = Readonly<Record<DrawBrushKind, DrawBrush>>

export type ResolvedDrawStyle = Readonly<{
  kind: DrawBrushKind
  color: string
  width: number
  opacity: number
}>

export type DrawPreview = Readonly<{
  kind: DrawBrushKind
  style: ResolvedDrawStyle
  points: readonly Point[]
}>

export const DRAW_SLOTS = ['1', '2', '3'] as const satisfies readonly DrawSlot[]

const DRAW_OPACITY: Readonly<Record<DrawBrushKind, number>> = {
  pen: 1,
  highlighter: 0.35
}

export const readDrawSlot = (
  state: DrawState,
  kind: DrawBrushKind
): DrawSlot => state[kind].slot

export const readDrawBrushStyle = (
  state: DrawState,
  kind: DrawBrushKind,
  slot: DrawSlot = state[kind].slot
): BrushStyle => state[kind].slots[slot]

export const readDrawStyle = (
  state: DrawState,
  kind: DrawBrushKind
): ResolvedDrawStyle => {
  const style = readDrawBrushStyle(state, kind)

  return {
    kind,
    color: style.color,
    width: style.width,
    opacity: DRAW_OPACITY[kind]
  }
}
