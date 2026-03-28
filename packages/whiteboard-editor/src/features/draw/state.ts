import { createValueStore, type ValueStore } from '@whiteboard/engine'
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

export type DrawPreferences = Readonly<Record<DrawBrushKind, DrawBrush>>
export type DrawState = DrawPreferences

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

export type DrawCommands = {
  slot: (kind: DrawBrushKind, slot: DrawSlot) => void
  patch: (
    kind: DrawBrushKind,
    slot: DrawSlot,
    patch: BrushStylePatch
  ) => void
}

export const DRAW_SLOTS = ['1', '2', '3'] as const satisfies readonly DrawSlot[]

const DEFAULT_DRAW_PREFERENCES: DrawPreferences = {
  pen: {
    slot: '1',
    slots: {
      '1': {
        color: 'hsl(var(--ui-text-primary, 40 2.1% 28%))',
        width: 2
      },
      '2': {
        color: 'hsl(var(--tag-blue-foreground, 206.5 74.4% 52.5%))',
        width: 4
      },
      '3': {
        color: 'hsl(var(--tag-purple-foreground, 278.6 32.7% 56.3%))',
        width: 8
      }
    }
  },
  highlighter: {
    slot: '1',
    slots: {
      '1': {
        color: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))',
        width: 12
      },
      '2': {
        color: 'hsl(var(--tag-green-background, 146.7 24.3% 92.7%))',
        width: 12
      },
      '3': {
        color: 'hsl(var(--tag-pink-background, 331.8 63% 94.7%))',
        width: 12
      }
    }
  }
}

const DRAW_OPACITY: Readonly<Record<DrawBrushKind, number>> = {
  pen: 1,
  highlighter: 0.35
}

const normalizeStyle = (
  value: BrushStyle
): BrushStyle => ({
  color: typeof value.color === 'string' && value.color.trim()
    ? value.color
    : DEFAULT_DRAW_PREFERENCES.pen.slots['1'].color,
  width: Number.isFinite(value.width)
    ? Math.max(1, value.width)
    : 1
})

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

const createInitialState = (): DrawPreferences => ({
  pen: {
    slot: DEFAULT_DRAW_PREFERENCES.pen.slot,
    slots: {
      '1': normalizeStyle(DEFAULT_DRAW_PREFERENCES.pen.slots['1']),
      '2': normalizeStyle(DEFAULT_DRAW_PREFERENCES.pen.slots['2']),
      '3': normalizeStyle(DEFAULT_DRAW_PREFERENCES.pen.slots['3'])
    }
  },
  highlighter: {
    slot: DEFAULT_DRAW_PREFERENCES.highlighter.slot,
    slots: {
      '1': normalizeStyle(DEFAULT_DRAW_PREFERENCES.highlighter.slots['1']),
      '2': normalizeStyle(DEFAULT_DRAW_PREFERENCES.highlighter.slots['2']),
      '3': normalizeStyle(DEFAULT_DRAW_PREFERENCES.highlighter.slots['3'])
    }
  }
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

export const createDrawState = (): {
  store: ValueStore<DrawPreferences>
  commands: DrawCommands
} => {
  const store = createValueStore<DrawPreferences>(createInitialState())

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
