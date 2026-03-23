import {
  Highlighter,
  PencilLine
} from 'lucide-react'
import type { DrawStyle } from '../../../features/draw/state'
import type { DrawPresetKey } from '../../../runtime/tool'
import {
  ColorSwatch,
  MenuSection
} from '../../menus/MenuPrimitives'
import {
  COLORS,
  DRAW_PRESET_OPTIONS,
  DRAW_STROKE_WIDTHS
} from '../../menus/options'

const DRAW_PRESET_ICONS = {
  pen: PencilLine,
  highlighter: Highlighter
} as const satisfies Record<DrawPresetKey, typeof PencilLine>

export const DrawMenu = ({
  preset,
  style,
  onPreset,
  onColor,
  onWidth
}: {
  preset: DrawPresetKey
  style: DrawStyle
  onPreset: (value: DrawPresetKey) => void
  onColor: (value: string) => void
  onWidth: (value: number) => void
}) => (
  <>
    <MenuSection title="Brush">
      <div className="wb-left-toolbar-draw-presets">
        {DRAW_PRESET_OPTIONS.map((option) => {
          const Icon = DRAW_PRESET_ICONS[option.key]
          return (
            <button
              key={option.key}
              type="button"
              className="wb-left-toolbar-draw-preset"
              data-active={preset === option.key ? 'true' : undefined}
              onClick={() => onPreset(option.key)}
              data-selection-ignore
              data-input-ignore
            >
              <span className="wb-left-toolbar-draw-preset-icon">
                <Icon size={18} strokeWidth={1} />
              </span>
              <span className="wb-left-toolbar-draw-preset-copy">{option.label}</span>
            </button>
          )
        })}
      </div>
    </MenuSection>
    <MenuSection title="Color">
      <div className="wb-node-toolbar-swatch-grid">
        {COLORS.map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            active={style.color === color}
            onClick={() => onColor(color)}
          />
        ))}
      </div>
    </MenuSection>
    <MenuSection title="Width">
      <div className="wb-left-toolbar-draw-widths">
        {DRAW_STROKE_WIDTHS.map((value) => (
          <button
            key={value}
            type="button"
            className="wb-left-toolbar-draw-width"
            data-active={style.width === value ? 'true' : undefined}
            onClick={() => onWidth(value)}
            data-selection-ignore
            data-input-ignore
            aria-label={`${value}px`}
            title={`${value}px`}
          >
            <span
              className="wb-left-toolbar-draw-width-stroke"
              style={{
                height: value,
                opacity: style.opacity,
                background: style.color
              }}
            />
          </button>
        ))}
      </div>
    </MenuSection>
  </>
)
