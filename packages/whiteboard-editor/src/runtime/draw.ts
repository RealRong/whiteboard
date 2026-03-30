import { createValueStore, type ValueStore } from '@whiteboard/engine'
import type { DrawBrushKind } from '../types/tool'
import type {
  BrushStyle,
  DrawBrush,
  DrawCommands,
  DrawPreferences,
  DrawSlot,
  ResolvedDrawStyle
} from '../types/draw'

export const DRAW_SLOTS = ['1', '2', '3'] as const satisfies readonly DrawSlot[]

const DRAW_OPACITY: Readonly<Record<DrawBrushKind, number>> = {
  pen: 1,
  highlighter: 0.35
}

const normalizeStyle = (
  value: BrushStyle
): BrushStyle => ({
  color: typeof value.color === 'string' && value.color.trim()
    ? value.color
    : 'currentColor',
  width: Number.isFinite(value.width)
    ? Math.max(1, value.width)
    : 1
})

const normalizeBrush = (
  brush: DrawBrush
): DrawBrush => {
  const slot = DRAW_SLOTS.includes(brush.slot)
    ? brush.slot
    : DRAW_SLOTS[0]

  return {
    slot,
    slots: {
      '1': normalizeStyle(brush.slots['1']),
      '2': normalizeStyle(brush.slots['2']),
      '3': normalizeStyle(brush.slots['3'])
    }
  }
}

const isSameStyle = (
  left: BrushStyle,
  right: BrushStyle
) => (
  left.color === right.color
  && left.width === right.width
)

const isSameBrush = (
  left: DrawBrush,
  right: DrawBrush
) => (
  left === right
  || (
    left.slot === right.slot
    && DRAW_SLOTS.every((slot) => isSameStyle(left.slots[slot], right.slots[slot]))
  )
)

export const normalizeDrawPreferences = (
  value: DrawPreferences
): DrawPreferences => ({
  pen: normalizeBrush(value.pen),
  highlighter: normalizeBrush(value.highlighter)
})

export const readDrawSlot = (
  state: DrawPreferences,
  kind: DrawBrushKind
): DrawSlot => state[kind].slot

export const readDrawBrushStyle = (
  state: DrawPreferences,
  kind: DrawBrushKind,
  slot: DrawSlot = state[kind].slot
): BrushStyle => state[kind].slots[slot]

export const readDrawStyle = (
  state: DrawPreferences,
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

export const createDrawState = (
  initialPreferences: DrawPreferences
): {
  store: ValueStore<DrawPreferences>
  commands: DrawCommands
} => {
  const store = createValueStore<DrawPreferences>(
    normalizeDrawPreferences(initialPreferences)
  )

  return {
    store,
    commands: {
      slot: (kind, slot) => {
        store.update((current) => {
          const previous = current[kind]
          if (previous.slot === slot) {
            return current
          }

          const next = {
            ...previous,
            slot
          }

          return isSameBrush(previous, next)
            ? current
            : {
                ...current,
                [kind]: next
              }
        })
      },
      patch: (kind, slot, patch) => {
        store.update((current) => {
          const previous = current[kind]
          const currentStyle = previous.slots[slot]
          const nextStyle = normalizeStyle({
            color: patch.color ?? currentStyle.color,
            width: patch.width ?? currentStyle.width
          })

          if (isSameStyle(currentStyle, nextStyle)) {
            return current
          }

          return {
            ...current,
            [kind]: {
              ...previous,
              slots: {
                ...previous.slots,
                [slot]: nextStyle
              }
            }
          }
        })
      }
    }
  }
}
