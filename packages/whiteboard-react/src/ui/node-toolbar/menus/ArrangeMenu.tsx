import type { NodeToolbarActionContext } from '../types'
import {
  ToolbarChip,
  ToolbarChipColumn
} from './controls'
import { runAndClose } from './actions'

export const ArrangeMenu = ({
  instance,
  nodes,
  close
}: NodeToolbarActionContext) => {
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
