import type { SelectionMode } from '@whiteboard/core/node'
import type { SelectionSummary } from '@whiteboard/core/selection'
import type {
  NodeId,
} from '@whiteboard/core/types'
import type { PointerDown } from '../input/pointer'
import type {
  SelectionDragAction,
  SelectionPressPlan,
  SelectionTapAction
} from '../../types/internal/selection'
import {
  applyNodeTapSelection,
  getCurrentSelection,
  isSelectedNode,
  isSingleSelectedNode,
  resolveSelectionMode,
  toNodeSelection,
  toVerifyNodeIds,
  type SelectionPressPolicyDeps
} from './pressRules'
import {
  readSelectionPressTarget,
  type SelectionPressTarget
} from './pressTarget'

const planBackgroundPress = (
  selection: SelectionSummary,
  mode: SelectionMode
): SelectionPressPlan => ({
  chrome: false,
  tap: mode === 'replace'
    ? { kind: 'clear' }
    : undefined,
  drag: {
    kind: 'marquee',
    match: 'touch',
    mode,
    base: getCurrentSelection(selection)
  },
  allowHold: false
})

const planSelectionBoxPress = (
  selection: SelectionSummary
): SelectionPressPlan | undefined => {
  if (!selection.target.nodeIds.length && !selection.target.edgeIds.length) {
    return undefined
  }

  if (!selection.boxInteractive || !selection.box) {
    return undefined
  }

  return {
    chrome: true,
    drag: selection.target.nodeIds.length > 0
      ? {
          kind: 'move',
          frame: selection.box,
          anchorId: selection.target.nodeIds[0]!,
          target: getCurrentSelection(selection)
        }
      : undefined,
    allowHold: true
  }
}

const planNodePress = (
  deps: Pick<SelectionPressPolicyDeps, 'getNode' | 'getNodeFrame'>,
  selection: SelectionSummary,
  mode: SelectionMode,
  target: Extract<SelectionPressTarget, { kind: 'node' }>
): SelectionPressPlan | undefined => {
  const {
    nodeId,
    hitNodeId,
    field
  } = target
  const node = deps.getNode(nodeId)
  const frame = deps.getNodeFrame(nodeId)
  if (!node || !frame) {
    return undefined
  }

  const selectedNodeIds = selection.target.nodeIds
  const selectedEdgeIds = selection.target.edgeIds
  const selected = isSelectedNode(node.id, selectedNodeIds)
  const repeat = mode === 'replace' && isSingleSelectedNode(node.id, selectedNodeIds)
  const dragCurrentSelection = Boolean(
    mode === 'replace'
    && target.selectedGroupId
  )
  const nextSelection = applyNodeTapSelection(
    selectedNodeIds,
    selectedEdgeIds,
    node.id,
    mode
  )
  const dragNodeIds = repeat
    ? selectedNodeIds
    : dragCurrentSelection
      ? selectedNodeIds
      : selected
        ? selectedNodeIds
        : nextSelection.nodeIds
  const dragEdgeIds =
    repeat || dragCurrentSelection || selected
      ? selectedEdgeIds
      : []
  const dragFrame =
    dragCurrentSelection && selection.box
      ? selection.box
      : frame
  const verifyNodeIds = toVerifyNodeIds(node.id, hitNodeId)

  return {
    chrome: selected || dragCurrentSelection,
    tap: node.locked
      ? {
          kind: 'select',
          target: nextSelection,
          verifyNodeIds
        }
      : repeat
        ? (
          nodeId === hitNodeId && field
            ? {
                kind: 'edit',
                nodeId: node.id,
                field,
                verifyNodeIds
              }
            : undefined
        )
        : {
            kind: 'select',
            target: nextSelection,
            verifyNodeIds
          },
    drag: {
      kind: 'move',
      frame: dragFrame,
      anchorId: dragCurrentSelection
        ? dragNodeIds[0]!
        : node.id,
      target: {
        nodeIds: dragNodeIds,
        edgeIds: dragEdgeIds
      },
      nextSelection: dragCurrentSelection
        ? undefined
        : toNodeSelection(dragNodeIds)
    },
    allowHold: true
  }
}

const planGroupShellPress = (
  deps: Pick<SelectionPressPolicyDeps, 'getNode' | 'getNodeFrame'>,
  selection: SelectionSummary,
  mode: SelectionMode,
  nodeId: NodeId
): SelectionPressPlan | undefined => {
  const node = deps.getNode(nodeId)
  const frame = deps.getNodeFrame(nodeId)
  if (!node || !frame) {
    return undefined
  }

  const selected = isSelectedNode(node.id, selection.target.nodeIds)
  const repeat = mode === 'replace' && selected
  const nextSelection = applyNodeTapSelection(
    selection.target.nodeIds,
    selection.target.edgeIds,
    node.id,
    mode
  )

  return {
    chrome: selected,
    tap: {
      kind: 'select',
      target: nextSelection
    },
    drag: repeat
      ? {
          kind: 'move',
          frame,
          anchorId: node.id,
          target: getCurrentSelection(selection),
          nextSelection: toNodeSelection(selection.target.nodeIds)
        }
      : {
          kind: 'marquee',
          match: 'touch',
          mode,
          base: getCurrentSelection(selection)
        },
    allowHold: true
  }
}

export const resolveSelectionPressPlan = (
  deps: SelectionPressPolicyDeps,
  input: {
    start: PointerDown
    selection: SelectionSummary
  }
): SelectionPressPlan | undefined => {
  const mode = resolveSelectionMode(input.start.event)
  const target = readSelectionPressTarget(deps, {
    pick: input.start.pick,
    field: input.start.field,
    mode,
    selectedNodeIds: input.selection.target.nodeIds
  })
  if (!target) {
    return undefined
  }

  switch (target.kind) {
    case 'background':
      return planBackgroundPress(input.selection, mode)
    case 'selection-box':
      return planSelectionBoxPress(input.selection)
    case 'node':
      return planNodePress(deps, input.selection, mode, target)
    case 'group-shell':
      return planGroupShellPress(deps, input.selection, mode, target.nodeId)
  }
}

export type {
  SelectionDragAction,
  SelectionPressPlan,
  SelectionTapAction
} from '../../types/internal/selection'
