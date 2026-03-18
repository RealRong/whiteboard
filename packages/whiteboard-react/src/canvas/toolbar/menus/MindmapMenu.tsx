import { ChipColumn, MenuSection } from '../../menus/MenuPrimitives'
import { MINDMAP_INSERT_PRESETS } from '../presets'

export const MindmapMenu = ({
  value,
  onChange
}: {
  value?: string
  onChange: (value: string) => void
}) => (
  <MenuSection title="Mindmap">
    <ChipColumn>
      {MINDMAP_INSERT_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          className="wb-left-toolbar-template"
          data-active={value === preset.key ? 'true' : undefined}
          onClick={() => onChange(preset.key)}
          data-selection-ignore
          data-input-ignore
        >
          <span className="wb-left-toolbar-template-title">{preset.label}</span>
          <span className="wb-left-toolbar-template-desc">{preset.description}</span>
        </button>
      ))}
    </ChipColumn>
  </MenuSection>
)
