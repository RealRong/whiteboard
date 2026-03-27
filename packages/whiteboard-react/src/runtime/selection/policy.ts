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
import type { GestureDown } from '../input/pointer'
import {
  isSelectionBoxInteractive,
  type View as SelectionView
} from './state'

type ModifierEventLike = {
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export type SelectionIds = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
}

export type SelectionPressSelection = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
  box?: Rect
  boxInteractive: boolean
}

export type SelectionTapMatch = {
  nodeId: NodeId
  hitNodeId: NodeId
}

export type SelectionPressTarget =
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

export type SelectionPressIntent =
  | { kind: 'clear' }
  | {
      kind: 'select'
      selection: SelectionIds
      match?: SelectionTapMatch
    }
  | {
      kind: 'edit'
      nodeId: NodeId
      field: EditField
      match: SelectionTapMatch
    }
  | {
      kind: 'move'
      frame: Rect
      anchorId: NodeId
      nodeIds: readonly NodeId[]
      edgeIds: readonly EdgeId[]
      select?: SelectionIds
    }
  | {
      kind: 'marquee'
      match: 'touch' | 'contain'
      mode: SelectionMode
      base: SelectionIds
    }

export type SelectionPressPlan = {
  chrome: boolean
  tap?: SelectionPressIntent
  drag?: SelectionPressIntent
  hold?: SelectionPressIntent
}

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

const resolveSelectionMode = (
  modifiers: ModifierEventLike
): SelectionMode => {
  if (modifiers.altKey) return 'subtract'
  if (modifiers.metaKey || modifiers.ctrlKey) return 'toggle'
  if (modifiers.shiftKey) return 'add'
  return 'replace'
}

const EMPTY_SELECTION: SelectionIds = {
  nodeIds: [],
  edgeIds: []
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
): SelectionIds => ({
  nodeIds,
  edgeIds: []
})

const applyNodeTapSelection = (
  selectedNodeIds: readonly NodeId[],
  selectedEdgeIds: readonly EdgeId[],
  nodeId: NodeId,
  mode: SelectionMode
): SelectionIds => ({
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
  selected: SelectionPressSelection
): SelectionIds => ({
  nodeIds: selected.nodeIds,
  edgeIds: selected.edgeIds
})

const createContainHoldIntent = (): SelectionPressIntent => ({
  kind: 'marquee',
  match: 'contain',
  mode: 'replace',
  base: EMPTY_SELECTION
})

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
    pick: GestureDown['pick']
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
    pick: GestureDown['pick']
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
  input: {
    mode: SelectionMode
    selected: SelectionPressSelection
  }
): SelectionPressPlan => ({
  chrome: false,
  tap: input.mode === 'replace'
    ? { kind: 'clear' }
    : undefined,
  drag: {
    kind: 'marquee',
    match: 'touch',
    mode: input.mode,
    base: getCurrentSelection(input.selected)
  }
})

const planSelectionBoxPress = (
  input: {
    selected: SelectionPressSelection
  }
): SelectionPressPlan | undefined => {
  if (!input.selected.nodeIds.length && !input.selected.edgeIds.length) {
    return undefined
  }

  if (!input.selected.boxInteractive || !input.selected.box) {
    return undefined
  }

  return {
    chrome: true,
    drag: input.selected.nodeIds.length > 0
      ? {
          kind: 'move',
          frame: input.selected.box,
          anchorId: input.selected.nodeIds[0]!,
          nodeIds: input.selected.nodeIds,
          edgeIds: input.selected.edgeIds
        }
      : undefined,
    hold: createContainHoldIntent()
  }
}

const planNodePress = (
  deps: Pick<PolicyDeps, 'getNode' | 'getNodeFrame'>,
  input: {
    mode: SelectionMode
    selected: SelectionPressSelection
  },
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

  const selectedNodeIds = input.selected.nodeIds
  const selectedEdgeIds = input.selected.edgeIds
  const selected = isSelectedNode(node.id, selectedNodeIds)
  const repeat =
    input.mode === 'replace'
    && isSingleSelectedNode(node.id, selectedNodeIds)
  const dragCurrentSelection = Boolean(
    input.mode === 'replace'
    && target.selectedGroupId
  )
  const select = applyNodeTapSelection(
    selectedNodeIds,
    selectedEdgeIds,
    node.id,
    input.mode
  )
  const dragNodeIds = repeat
    ? selectedNodeIds
    : dragCurrentSelection
      ? selectedNodeIds
      : selected
        ? selectedNodeIds
        : (select.nodeIds ?? [])
  const dragEdgeIds =
    repeat || dragCurrentSelection || selected
      ? selectedEdgeIds
      : []
  const dragFrame =
    dragCurrentSelection && input.selected.box
      ? input.selected.box
      : frame
  const match: SelectionTapMatch = {
    nodeId: node.id,
    hitNodeId
  }

  return {
    chrome: selected || dragCurrentSelection,
    tap: node.locked
      ? {
          kind: 'select',
          selection: select,
          match
        }
      : repeat
        ? (
          nodeId === hitNodeId && field
            ? {
                kind: 'edit',
                nodeId: node.id,
                field,
                match
              }
            : undefined
        )
        : {
            kind: 'select',
            selection: select,
            match
          },
    drag: {
      kind: 'move',
      frame: dragFrame,
      anchorId: dragCurrentSelection
        ? dragNodeIds[0]!
        : node.id,
      nodeIds: dragNodeIds,
      edgeIds: dragEdgeIds,
      select: dragCurrentSelection
        ? undefined
        : toNodeSelection(dragNodeIds)
    },
    hold: createContainHoldIntent()
  }
}

const planGroupShellPress = (
  deps: Pick<PolicyDeps, 'getNode' | 'getNodeFrame'>,
  input: {
    mode: SelectionMode
    selected: SelectionPressSelection
  },
  nodeId: NodeId
): SelectionPressPlan | undefined => {
  const node = deps.getNode(nodeId)
  const frame = deps.getNodeFrame(nodeId)
  if (!node || !frame) {
    return undefined
  }

  const selected = isSelectedNode(node.id, input.selected.nodeIds)
  const repeat = input.mode === 'replace' && selected
  const select = applyNodeTapSelection(
    input.selected.nodeIds,
    input.selected.edgeIds,
    node.id,
    input.mode
  )

  return {
    chrome: selected,
    tap: {
      kind: 'select',
      selection: select
    },
    drag: repeat
      ? {
          kind: 'move',
          frame,
          anchorId: node.id,
          nodeIds: input.selected.nodeIds,
          edgeIds: input.selected.edgeIds,
          select: toNodeSelection(input.selected.nodeIds)
        }
      : {
          kind: 'marquee',
          match: 'touch',
          mode: input.mode,
          base: getCurrentSelection(input.selected)
        },
    hold: createContainHoldIntent()
  }
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
    boxInteractive: isSelectionBoxInteractive(selection)
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

  switch (target.kind) {
    case 'background':
      return planBackgroundPress(ctx)
    case 'selection-box':
      return planSelectionBoxPress(ctx)
    case 'node':
      return planNodePress(deps, ctx, target)
    case 'group-shell':
      return planGroupShellPress(deps, ctx, target.nodeId)
  }
}
