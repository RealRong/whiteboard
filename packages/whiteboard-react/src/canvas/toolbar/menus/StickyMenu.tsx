import { MenuSection } from '../../menus/MenuPrimitives'
import {
  STICKY_INSERT_OPTIONS,
  STICKY_INSERT_PRESETS
} from '../presets'

export const StickyMenu = ({
  value,
  onChange
}: {
  value?: string
  onChange: (value: string) => void
}) => (
  <MenuSection title="Sticky notes">
    <div className="wb-left-toolbar-note-grid">
      {STICKY_INSERT_PRESETS.map((preset, index) => {
        const option = STICKY_INSERT_OPTIONS[index]
        return (
          <button
            key={preset.key}
            type="button"
            className="wb-left-toolbar-note-option"
            data-active={value === preset.key ? 'true' : undefined}
            onClick={() => onChange(preset.key)}
            data-selection-ignore
            data-input-ignore
          >
            <span
              className="wb-left-toolbar-note-preview"
              style={{
                background: option.fill
              }}
            />
            <span className="wb-left-toolbar-note-label">{preset.label}</span>
          </button>
        )
      })}
    </div>
  </MenuSection>
)
