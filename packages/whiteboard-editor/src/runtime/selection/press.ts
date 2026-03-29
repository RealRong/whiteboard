import {
  applySelection,
  findGroupAncestor,
  type SelectionMode
} from '@whiteboard/core/node'
import type {
  EdgeId,
  Node,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { NodeRole } from '../../types/node'
import type { EditField } from '../edit'
import type { PointerDown } from '../input/pointer'
import type {
  SelectionDragAction,
  SelectionPressPlan,
  SelectionSnapshot,
  SelectionTarget,
  SelectionTapAction
} from '../../types/internal/selection'

type ModifierEventLike = {
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

type PolicyDeps = {
  getNode: (nodeId: NodeId) => Node | undefined
  getOwnerId: (nodeId: NodeId) => NodeId | undefined
  getNodeFrame: (nodeId: NodeId) => Rect | undefined
  getNodeRole: (node: Node) => NodeRole
}

type SelectionPressTarget =
  | { kind: 'background' }
  | { kind: 'selection-box' }
  | {
      kind: 'node'
      nodeId: NodeId
      hitNodeId: NodeId
      selectedGroupId?: NodeId
      field?: EditField
    }
  | {
      kind: 'group-shell'
      nodeId: NodeId
    }

const resolveSelectionMode = (
  modifiers: ModifierEventLike
): SelectionMode => {
  if (modifiers.altKey) return 'subtract'
  if (modifiers.metaKey || modifiers.ctrlKey) return 'toggle'
  if (modifiers.shiftKey) return 'add'
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
  selection: SelectionSnapshot
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
  deps: Pick<PolicyDeps, 'getNode' | 'getOwnerId'>,
  nodeId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => findGroupAncestor(
  nodeId,
  deps.getNode,
  deps.getOwnerId,
  (groupId) => selectedNodeIds.includes(groupId)
)

const resolvePressNodeId = (
  deps: Pick<PolicyDeps, 'getNode' | 'getOwnerId'>,
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

const readPressNodeTarget = (
  deps: Pick<PolicyDeps, 'getNode' | 'getOwnerId'>,
  input: {
    pick: PointerDown['pick']
    field?: EditField
    mode: SelectionMode
    selectedNodeIds: readonly NodeId[]
  },
  nodeId: NodeId
): SelectionPressTarget => ({
  kind: 'node',
  nodeId: resolvePressNodeId(deps, input, nodeId),
  hitNodeId: nodeId,
  selectedGroupId:
    input.mode === 'replace'
      ? findSelectedGroupId(deps, nodeId, input.selectedNodeIds)
      : undefined,
  field: input.field
})

const readSelectionPressTarget = (
  deps: PolicyDeps,
  input: {
    pick: PointerDown['pick']
    field?: EditField
    mode: SelectionMode
    selectedNodeIds: readonly NodeId[]
  }
): SelectionPressTarget | undefined => {
  const { pick } = input

  switch (pick.kind) {
    case 'background':
      return { kind: 'background' }
    case 'selection-box':
      return pick.part === 'body'
        ? { kind: 'selection-box' }
        : undefined
    case 'node':
      if (pick.part === 'body') {
        return readPressNodeTarget(deps, input, pick.id)
      }

      if (pick.part !== 'shell') {
        return undefined
      }

      const node = deps.getNode(pick.id)
      const role = node
        ? deps.getNodeRole(node)
        : undefined

      if (role === 'frame') {
        return {
          kind: 'node',
          nodeId: pick.id,
          hitNodeId: pick.id,
          field: input.field
        }
      }

      return role === 'group'
        ? {
            kind: 'group-shell',
            nodeId: pick.id
          }
        : undefined
    case 'edge':
    case 'mindmap':
      return undefined
  }
}

const planBackgroundPress = (
  selection: SelectionSnapshot,
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
  selection: SelectionSnapshot
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
  deps: Pick<PolicyDeps, 'getNode' | 'getNodeFrame'>,
  selection: SelectionSnapshot,
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
  deps: Pick<PolicyDeps, 'getNode' | 'getNodeFrame'>,
  selection: SelectionSnapshot,
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
  deps: PolicyDeps,
  input: {
    start: PointerDown
    snapshot: SelectionSnapshot
  }
): SelectionPressPlan | undefined => {
  const mode = resolveSelectionMode(input.start.event)
  const target = readSelectionPressTarget(deps, {
    pick: input.start.pick,
    field: input.start.field,
    mode,
    selectedNodeIds: input.snapshot.target.nodeIds
  })
  if (!target) {
    return undefined
  }

  switch (target.kind) {
    case 'background':
      return planBackgroundPress(input.snapshot, mode)
    case 'selection-box':
      return planSelectionBoxPress(input.snapshot)
    case 'node':
      return planNodePress(deps, input.snapshot, mode, target)
    case 'group-shell':
      return planGroupShellPress(deps, input.snapshot, mode, target.nodeId)
  }
}

export type {
  SelectionDragAction,
  SelectionPressPlan,
  SelectionTapAction
} from '../../types/internal/selection'
