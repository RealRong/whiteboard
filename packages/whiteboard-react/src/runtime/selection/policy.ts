import {
  resolveSelectionMode,
  resolveSelectionPressPlan,
  type SelectionMode,
  type SelectionPressIntent as CoreSelectionPressIntent,
  type SelectionPressPlan as CoreSelectionPressPlan,
  type SelectionPressSelection,
  type SelectionTapMatch as CoreSelectionTapMatch
} from '@whiteboard/core/node'
import type {
  Node,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { NodeRole } from '../../types/node'
import type { EditField } from '../edit'
import type { GestureDown } from '../input/pointer'
import { readSelectionPressTarget } from '../input/target'
import type { View as SelectionView } from './state'

export type SelectionTapMatch = CoreSelectionTapMatch
export type SelectionPressIntent = CoreSelectionPressIntent<EditField>
export type SelectionPressPlan = CoreSelectionPressPlan<EditField>

export type SelectionPressContext = {
  input: GestureDown
  mode: SelectionMode
  selected: SelectionPressSelection
}

type PolicyDeps = {
  getNode: (nodeId: NodeId) => Node | undefined
  getOwnerId: (nodeId: NodeId) => NodeId | undefined
  getNodeFrame: (nodeId: NodeId) => Rect | undefined
  getNodeRole: (node: Node) => NodeRole
}

export const readSelectionPressContext = (
  input: GestureDown,
  selection: SelectionView
): SelectionPressContext => ({
  input,
  mode: resolveSelectionMode(input.event),
  selected: {
    nodeIds: selection.target.nodeIds,
    edgeIds: selection.target.edgeIds,
    box: selection.box,
    boxInteractive: Boolean(selection.box)
      && (
        selection.items.count > 1
        || selection.transform.resize === 'scale'
      )
  }
})

export const readSelectionPressPlan = (
  deps: PolicyDeps,
  ctx: SelectionPressContext
): SelectionPressPlan | undefined => {
  const target = readSelectionPressTarget(deps, {
    pick: ctx.input.pick,
    field: ctx.input.field,
    mode: ctx.mode,
    selectedNodeIds: ctx.selected.nodeIds
  })
  if (!target) {
    return undefined
  }

  return resolveSelectionPressPlan<EditField>({
    getNode: deps.getNode,
    getNodeFrame: deps.getNodeFrame
  }, {
    target,
    mode: ctx.mode,
    selected: ctx.selected
  })
}
