import { createValueStore, type ValueStore } from '@whiteboard/core/runtime'
import type { Point } from '@whiteboard/core/types'
import type { DrawPresetKey, Tool } from '../tool'
import { DEFAULT_DRAW_PRESET_KEY } from '../tool'

export type DrawStyle = Readonly<{
  color: string
  width: number
  opacity: number
}>

export type DrawStylePatch = Partial<DrawStyle>

export type DrawState = Readonly<{
  byPreset: Record<DrawPresetKey, DrawStyle>
}>

export type DrawPreview = Readonly<{
  preset: DrawPresetKey
  style: DrawStyle
  points: readonly Point[]
}>

export type DrawRead = {
  style: (preset?: DrawPresetKey) => DrawStyle
}

export type DrawCommands = {
  set: (patch: DrawStylePatch, preset?: DrawPresetKey) => void
}

export type DrawRuntime = {
  style: ValueStore<DrawState>
  preview: ValueStore<DrawPreview | null>
  read: DrawRead
  commands: DrawCommands
  clear: () => void
}

const DEFAULT_DRAW_STYLE_BY_PRESET: Record<DrawPresetKey, DrawStyle> = {
  'draw.pen': {
    color: 'hsl(var(--ui-text-primary, 40 2.1% 28%))',
    width: 2,
    opacity: 1
  },
  'draw.highlighter': {
    color: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))',
    width: 12,
    opacity: 0.35
  }
}

const clampOpacity = (
  value: number
) => Math.min(1, Math.max(0, value))

const normalizeStyle = (
  value: DrawStyle
): DrawStyle => ({
  color: typeof value.color === 'string' && value.color.trim()
    ? value.color
    : DEFAULT_DRAW_STYLE_BY_PRESET[DEFAULT_DRAW_PRESET_KEY].color,
  width: Number.isFinite(value.width) ? Math.max(1, value.width) : 1,
  opacity: Number.isFinite(value.opacity) ? clampOpacity(value.opacity) : 1
})

const createState = (): DrawState => ({
  byPreset: {
    'draw.pen': normalizeStyle(DEFAULT_DRAW_STYLE_BY_PRESET['draw.pen']),
    'draw.highlighter': normalizeStyle(DEFAULT_DRAW_STYLE_BY_PRESET['draw.highlighter'])
  }
})

const isSameStyle = (
  left: DrawStyle,
  right: DrawStyle
) => (
  left.color === right.color
  && left.width === right.width
  && left.opacity === right.opacity
)

const resolvePreset = (
  tool: Tool,
  preset?: DrawPresetKey
): DrawPresetKey => {
  if (preset) {
    return preset
  }

  return tool.type === 'draw'
    ? tool.preset
    : DEFAULT_DRAW_PRESET_KEY
}

export const createDrawRuntime = ({
  getTool
}: {
  getTool: () => Tool
}): DrawRuntime => {
  const style = createValueStore<DrawState>(createState())
  const preview = createValueStore<DrawPreview | null>(null)

  const readStyle = (
    preset?: DrawPresetKey
  ) => {
    const key = resolvePreset(getTool(), preset)
    return style.get().byPreset[key]
  }

  return {
    style,
    preview,
    read: {
      style: readStyle
    },
    commands: {
      set: (patch, preset) => {
        const key = resolvePreset(getTool(), preset)
        style.update((current) => {
          const previous = current.byPreset[key]
          const next = normalizeStyle({
            color: patch.color ?? previous.color,
            width: patch.width ?? previous.width,
            opacity: patch.opacity ?? previous.opacity
          })

          if (isSameStyle(previous, next)) {
            return current
          }

          return {
            byPreset: {
              ...current.byPreset,
              [key]: next
            }
          }
        })
      }
    },
    clear: () => {
      preview.set(null)
    }
  }
}
