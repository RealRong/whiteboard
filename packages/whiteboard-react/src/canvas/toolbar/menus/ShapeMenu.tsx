import { Chip, ChipColumn, MenuSection } from '../../menus/MenuPrimitives'
import { SHAPE_INSERT_PRESETS } from '../presets'

export const ShapeMenu = ({
  value,
  onChange
}: {
  value?: string
  onChange: (value: string) => void
}) => (
  <>
    <MenuSection title="Basic shapes">
      <ChipColumn>
        {SHAPE_INSERT_PRESETS.slice(0, 4).map((preset) => (
          <Chip
            key={preset.key}
            active={value === preset.key}
            onClick={() => onChange(preset.key)}
          >
            {preset.label}
          </Chip>
        ))}
      </ChipColumn>
    </MenuSection>
    <MenuSection title="Annotations">
      <ChipColumn>
        {SHAPE_INSERT_PRESETS.slice(4).map((preset) => (
          <Chip
            key={preset.key}
            active={value === preset.key}
            onClick={() => onChange(preset.key)}
          >
            {preset.label}
          </Chip>
        ))}
      </ChipColumn>
    </MenuSection>
  </>
)
