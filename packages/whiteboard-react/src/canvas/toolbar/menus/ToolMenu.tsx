import { Chip, ChipColumn, MenuSection } from '../../menus/MenuPrimitives'

export type ToolMenuValue =
  | 'select'
  | 'hand'
  | 'connector'

export const ToolMenu = ({
  value,
  onChange
}: {
  value: ToolMenuValue
  onChange: (value: ToolMenuValue) => void
}) => (
  <MenuSection title="Tool">
    <ChipColumn>
      <Chip active={value === 'select'} onClick={() => onChange('select')}>
        Select
      </Chip>
      <Chip active={value === 'hand'} onClick={() => onChange('hand')}>
        Hand
      </Chip>
      <Chip active={value === 'connector'} onClick={() => onChange('connector')}>
        Connector
      </Chip>
    </ChipColumn>
  </MenuSection>
)
