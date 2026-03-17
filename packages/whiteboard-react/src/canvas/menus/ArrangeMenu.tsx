import {
  Chip,
  ChipColumn
} from './MenuPrimitives'

export const ArrangeMenu = ({
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack
}: {
  onBringToFront: () => void
  onBringForward: () => void
  onSendBackward: () => void
  onSendToBack: () => void
}) => (
  <ChipColumn>
    <Chip onClick={onBringToFront}>
      Front
    </Chip>
    <Chip onClick={onSendToBack}>
      Back
    </Chip>
    <Chip onClick={onBringForward}>
      Forward
    </Chip>
    <Chip onClick={onSendBackward}>
      Backward
    </Chip>
  </ChipColumn>
)
