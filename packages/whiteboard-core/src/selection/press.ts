import { applySelection, findGroupAncestor, type SelectionMode } from '../node'
import type { EdgeId, Node, NodeId, Rect } from '../types'
import type { SelectionSummary } from './summary'
import type { SelectionTarget } from './target'

type ModifierEventLike = {
  alt: boolean
  shift: boolean
  ctrl: boolean
  meta: boolean
}

export type SelectionPressSubject<TField extends string = string> =
  | { kind: 'background' }
  | {
      kind: 'selection-box'
      part: 'body' | 'transform'
    }
  | {
      kind: 'node'
      nodeId: NodeId
      part: 'body' | 'shell'
      shell?: 'content' | 'frame' | 'group'
      field?: TField
    }

export type SelectionTapAction<TField extends string = string> =
  | { kind: 'clear' }
  | {
      kind: 'select'
      target: SelectionTarget
      verifyNodeIds?: readonly NodeId[]
    }
  | {
      kind: 'edit'
      nodeId: NodeId
      field: TField
      verifyNodeIds: readonly NodeId[]
    }

export type SelectionDragAction =
  | {
      kind: 'move'
      frame: Rect
      anchorId: NodeId
      target: SelectionTarget
      nextSelection?: SelectionTarget
    }
  | {
      kind: 'marquee'
      match: 'touch' | 'contain'
      mode: SelectionMode
      base: SelectionTarget
    }

export type SelectionPressPlan<TField extends string = string> = {
  chrome: boolean
  tap?: SelectionTapAction<TField>
  drag?: SelectionDragAction
  allowHold: boolean
}

export type SelectionPressTarget<TField extends string = string> =
  | { kind: 'background' }
  | { kind: 'selection-box' }
  | {
      kind: 'node'
      nodeId: NodeId
      hitNodeId: NodeId
      selectedGroupId?: NodeId
      field?: TField
    }
  | {
      kind: 'group-shell'
      nodeId: NodeId
    }

export type SelectionPressPolicyDeps = {
  getNode: (nodeId: NodeId) => Node | undefined
  getOwnerId: (nodeId: NodeId) => NodeId | undefined
  getNodeFrame: (nodeId: NodeId) => Rect | undefined
}

export const resolveSelectionPressMode = (
  modifiers: ModifierEventLike
): SelectionMode => {
  if (modifiers.alt) return 'subtract'
  if (modifiers.meta || modifiers.ctrl) return 'toggle'
  if (modifiers.shift) return 'add'
  return 'replace'
}

const isSingleSelectedNode = (
  nodeId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => (
  selectedNodeIds.length === 1
  && selectedNodeIds[0] === nodeId
)

const isSelectedNode = (
  nodeId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => selectedNodeIds.includes(nodeId)

const toNodeSelection = (
  nodeIds: readonly NodeId[]
): SelectionTarget => ({
  nodeIds,
  edgeIds: []
})

const applyNodeTapSelection = (
  selectedNodeIds: readonly NodeId[],
  selectedEdgeIds: readonly EdgeId[],
  nodeId: NodeId,
  mode: SelectionMode
): SelectionTarget => ({
  nodeIds: [
    ...applySelection(
      new Set(selectedNodeIds),
      [nodeId],
      mode
    )
  ],
  edgeIds: [
    ...applySelection(
      new Set(selectedEdgeIds),
      [],
      mode
    )
  ]
})

const getCurrentSelection = (
  selection: SelectionSummary
): SelectionTarget => ({
  nodeIds: selection.target.nodeIds,
  edgeIds: selection.target.edgeIds
})

const toVerifyNodeIds = (
  nodeId: NodeId,
  hitNodeId: NodeId
): readonly NodeId[] => (
  nodeId === hitNodeId
    ? [nodeId]
    : [nodeId, hitNodeId]
)

const findSelectedGroupId = (
  deps: Pick<SelectionPressPolicyDeps, 'getNode' | 'getOwnerId'>,
  nodeId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => findGroupAncestor(
  nodeId,
  deps.getNode,
  deps.getOwnerId,
  (groupId) => selectedNodeIds.includes(groupId)
)

const resolvePressNodeId = (
  deps: Pick<SelectionPressPolicyDeps, 'getNode' | 'getOwnerId'>,
  input: {
    mode: SelectionMode
    selectedNodeIds: readonly NodeId[]
  },
  nodeId: NodeId
) => {
  if (input.mode !== 'replace') {
    return nodeId
  }

  const node = deps.getNode(nodeId)
  if (!node || node.type === 'group') {
    return nodeId
  }

  const groupId = findGroupAncestor(nodeId, deps.getNode, deps.getOwnerId)
  if (!groupId) {
    return nodeId
  }

  const selectedNodeIds = input.selectedNodeIds
  if (
    selectedNodeIds.includes(nodeId)
    || selectedNodeIds.includes(groupId)
  ) {
    return nodeId
  }

  return selectedNodeIds.some((selectedNodeId) =>
    Boolean(findGroupAncestor(
      selectedNodeId,
      deps.getNode,
      deps.getOwnerId,
      (currentId) => currentId === groupId
    ))
  )
    ? nodeId
    : groupId
}

const readPressNodeTarget = <TField extends string>(
  deps: Pick<SelectionPressPolicyDeps, 'getNode' | 'getOwnerId'>,
  input: {
    field?: TField
    mode: SelectionMode
    selectedNodeIds: readonly NodeId[]
  },
  nodeId: NodeId
): SelectionPressTarget<TField> => ({
  kind: 'node',
  nodeId: resolvePressNodeId(deps, input, nodeId),
  hitNodeId: nodeId,
  selectedGroupId:
    input.mode === 'replace'
      ? findSelectedGroupId(deps, nodeId, input.selectedNodeIds)
      : undefined,
  field: input.field
})

export const resolveSelectionPressTarget = <TField extends string>(
  deps: SelectionPressPolicyDeps,
  input: {
    subject: SelectionPressSubject<TField>
    mode: SelectionMode
    selectedNodeIds: readonly NodeId[]
  }
): SelectionPressTarget<TField> | undefined => {
  const { subject } = input

  switch (subject.kind) {
    case 'background':
      return { kind: 'background' }
    case 'selection-box':
      return subject.part === 'body'
        ? { kind: 'selection-box' }
        : undefined
    case 'node':
      if (subject.part === 'body') {
        return readPressNodeTarget(deps, input, subject.nodeId)
      }

      if (subject.shell === 'frame') {
        return {
          kind: 'node',
          nodeId: subject.nodeId,
          hitNodeId: subject.nodeId,
          field: subject.field
        }
      }

      return subject.shell === 'group'
        ? {
            kind: 'group-shell',
            nodeId: subject.nodeId
          }
        : undefined
  }
}

const planBackgroundPress = <TField extends string>(
  selection: SelectionSummary,
  mode: SelectionMode
): SelectionPressPlan<TField> => ({
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

const planSelectionBoxPress = <TField extends string>(
  selection: SelectionSummary
): SelectionPressPlan<TField> | undefined => {
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

const planNodePress = <TField extends string>(
  deps: Pick<SelectionPressPolicyDeps, 'getNode' | 'getNodeFrame'>,
  selection: SelectionSummary,
  mode: SelectionMode,
  target: Extract<SelectionPressTarget<TField>, { kind: 'node' }>
): SelectionPressPlan<TField> | undefined => {
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

const planGroupShellPress = <TField extends string>(
  deps: Pick<SelectionPressPolicyDeps, 'getNode' | 'getNodeFrame'>,
  selection: SelectionSummary,
  mode: SelectionMode,
  nodeId: NodeId
): SelectionPressPlan<TField> | undefined => {
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

export const resolveSelectionPressPlan = <TField extends string>(
  deps: SelectionPressPolicyDeps,
  input: {
    modifiers: ModifierEventLike
    selection: SelectionSummary
    subject: SelectionPressSubject<TField>
  }
): SelectionPressPlan<TField> | undefined => {
  const mode = resolveSelectionPressMode(input.modifiers)
  const target = resolveSelectionPressTarget(deps, {
    subject: input.subject,
    mode,
    selectedNodeIds: input.selection.target.nodeIds
  })
  if (!target) {
    return undefined
  }

  switch (target.kind) {
    case 'background':
      return planBackgroundPress<TField>(input.selection, mode)
    case 'selection-box':
      return planSelectionBoxPress<TField>(input.selection)
    case 'node':
      return planNodePress(deps, input.selection, mode, target)
    case 'group-shell':
      return planGroupShellPress<TField>(deps, input.selection, mode, target.nodeId)
  }
}
