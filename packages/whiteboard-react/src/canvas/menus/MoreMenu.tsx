import {
  Chip,
  ChipColumn
} from './MenuPrimitives'

export const MoreMenu = ({
  canDuplicate,
  canDelete,
  onDuplicate,
  onDelete
}: {
  canDuplicate: boolean
  canDelete: boolean
  onDuplicate: () => void
  onDelete: () => void
}) => (
  <ChipColumn>
    <Chip
      disabled={!canDuplicate}
      onClick={onDuplicate}
    >
      Duplicate
    </Chip>
    <Chip
      disabled={!canDelete}
      onClick={onDelete}
    >
      Delete
    </Chip>
  </ChipColumn>
)
