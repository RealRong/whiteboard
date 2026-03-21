import { clamp } from '@whiteboard/core/geometry'
import { createValueStore, type ValueStore } from '@whiteboard/core/runtime'
import type { Point } from '@whiteboard/core/types'
import type { DrawPresetKey } from '../../runtime/tool'
import { DEFAULT_DRAW_PRESET_KEY } from '../../runtime/tool'

export type DrawStyle = Readonly<{
  color: string
  width: number
  opacity: number
}>

export type DrawStylePatch = Partial<DrawStyle>

export type DrawStyles = Readonly<Record<DrawPresetKey, DrawStyle>>

export type DrawPreview = Readonly<{
  preset: DrawPresetKey
  style: DrawStyle
  points: readonly Point[]
}>

export type DrawCommands = {
  patch: (preset: DrawPresetKey, patch: DrawStylePatch) => void
}

const DEFAULT_DRAW_STYLES: DrawStyles = {
  pen: {
    color: 'hsl(var(--ui-text-primary, 40 2.1% 28%))',
    width: 2,
    opacity: 1
  },
  highlighter: {
    color: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))',
    width: 12,
    opacity: 0.35
  }
}

const normalizeStyle = (
  value: DrawStyle
): DrawStyle => ({
  color: typeof value.color === 'string' && value.color.trim()
    ? value.color
    : DEFAULT_DRAW_STYLES[DEFAULT_DRAW_PRESET_KEY].color,
  width: Number.isFinite(value.width) ? Math.max(1, value.width) : 1,
  opacity: Number.isFinite(value.opacity) ? clamp(value.opacity, 0, 1) : 1
})

const isSameStyle = (
  left: DrawStyle,
  right: DrawStyle
) => (
  left.color === right.color
  && left.width === right.width
  && left.opacity === right.opacity
)

const createInitialStyles = (): DrawStyles => ({
  pen: normalizeStyle(DEFAULT_DRAW_STYLES.pen),
  highlighter: normalizeStyle(DEFAULT_DRAW_STYLES.highlighter)
})

export const createDrawState = (): {
  store: ValueStore<DrawStyles>
  commands: DrawCommands
} => {
  const store = createValueStore<DrawStyles>(createInitialStyles())

  return {
    store,
    commands: {
      patch: (preset, patch) => {
        store.update((current) => {
          const previous = current[preset]
          const next = normalizeStyle({
            color: patch.color ?? previous.color,
            width: patch.width ?? previous.width,
            opacity: patch.opacity ?? previous.opacity
          })

          if (isSameStyle(previous, next)) {
            return current
          }

          return {
            ...current,
            [preset]: next
          }
        })
      }
    }
  }
}
