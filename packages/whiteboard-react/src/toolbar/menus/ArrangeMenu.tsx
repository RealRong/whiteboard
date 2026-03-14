import type { NodeToolbarMenuProps } from '../model'
import {
  runAndClose,
  ToolbarChip,
  ToolbarChipColumn
} from './ui'

export const ArrangeMenu = ({
  instance,
  nodes,
  close
}: NodeToolbarMenuProps) => {
  const nodeIds = nodes.map((node) => node.id)

  return (
    <ToolbarChipColumn>
      <ToolbarChip
        onClick={() => {
          runAndClose(close, instance.commands.node.order.bringToFront(nodeIds))
        }}
      >
        Front
      </ToolbarChip>
      <ToolbarChip
        onClick={() => {
          runAndClose(close, instance.commands.node.order.sendToBack(nodeIds))
        }}
      >
        Back
      </ToolbarChip>
      <ToolbarChip
        onClick={() => {
          runAndClose(close, instance.commands.node.order.bringForward(nodeIds))
        }}
      >
        Forward
      </ToolbarChip>
      <ToolbarChip
        onClick={() => {
          runAndClose(close, instance.commands.node.order.sendBackward(nodeIds))
        }}
      >
        Backward
      </ToolbarChip>
    </ToolbarChipColumn>
  )
}
