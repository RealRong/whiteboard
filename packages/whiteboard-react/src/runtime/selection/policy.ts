import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type {
  Node,
  NodeId,
  EdgeId,
  Rect
} from '@whiteboard/core/types'
import type { NodeRole } from '../../types/node'
import type { EditField } from '../edit'
import type { GestureDown } from '../input/pointer'
import type { Input as SelectionInput, View as SelectionView } from './state'

export type SelectionPressSelection = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
  box?: Rect
}

export type SelectionPressContext = {
  input: GestureDown
  mode: SelectionMode
  selected: SelectionPressSelection
}

export type SelectionTapMatch = {
  nodeId: NodeId
  hitNodeId: NodeId
}

export type SelectionPressIntent =
  | { kind: 'clear' }
  | {
      kind: 'select'
      selection: SelectionInput
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
      select?: SelectionInput
    }
  | {
      kind: 'marquee'
      match: 'touch' | 'contain'
      mode: SelectionMode
      base: SelectionInput
    }

export type SelectionPressPlan = {
  chrome: boolean
  tap?: SelectionPressIntent
  drag?: SelectionPressIntent
  hold?: SelectionPressIntent
}

type PolicyDeps = {
  getSelection: () => SelectionView
  getNode: (nodeId: NodeId) => Node | undefined
  getNodeFrame: (nodeId: NodeId) => Rect | undefined
  getNodeRole: (node: Node) => NodeRole
}

const EMPTY_SELECTION: SelectionInput = {
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
): SelectionInput => ({
  nodeIds,
  edgeIds: []
})

const applyNodeTapSelection = (
  selectedNodeIds: readonly NodeId[],
  selectedEdgeIds: readonly EdgeId[],
  nodeId: NodeId,
  mode: SelectionMode
): SelectionInput => ({
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
  ctx: SelectionPressContext
): SelectionInput => ({
  nodeIds: ctx.selected.nodeIds,
  edgeIds: ctx.selected.edgeIds
})

const findNearestGroup = (
  deps: PolicyDeps,
  nodeId: NodeId,
  match?: (groupId: NodeId) => boolean
) => {
  let current = deps.getNode(nodeId)

  while (current?.groupId) {
    const group = deps.getNode(current.groupId)
    if (!group) {
      return undefined
    }

    if (
      group.type === 'group'
      && (!match || match(group.id))
    ) {
      return group.id
    }

    current = group
  }

  return undefined
}

const isNodeInGroup = (
  deps: PolicyDeps,
  nodeId: NodeId,
  groupId: NodeId
) => Boolean(findNearestGroup(deps, nodeId, (currentId) => currentId === groupId))

const resolvePressNodeId = (
  deps: PolicyDeps,
  ctx: SelectionPressContext,
  nodeId: NodeId
) => {
  if (ctx.mode !== 'replace') {
    return nodeId
  }

  const node = deps.getNode(nodeId)
  if (!node || node.type === 'group') {
    return nodeId
  }

  const groupId = findNearestGroup(deps, nodeId)
  if (!groupId) {
    return nodeId
  }

  const selectedNodeIds = ctx.selected.nodeIds
  if (
    selectedNodeIds.includes(nodeId)
    || selectedNodeIds.includes(groupId)
  ) {
    return nodeId
  }

  return selectedNodeIds.some((selectedNodeId) =>
    isNodeInGroup(deps, selectedNodeId, groupId)
  )
    ? nodeId
    : groupId
}

const canInteractSelectionBox = (
  selection: SelectionView
) => {
  const box = selection.box
  const canResize = selection.transform.resize === 'scale'

  return {
    box,
    interactive: Boolean(box) && (selection.items.count > 1 || canResize)
  }
}

const createContainHoldIntent = (): SelectionPressIntent => ({
  kind: 'marquee',
  match: 'contain',
  mode: 'replace',
  base: EMPTY_SELECTION
})

const planBackgroundPress = (
  ctx: SelectionPressContext
): SelectionPressPlan => ({
  chrome: false,
  tap: ctx.mode === 'replace'
    ? { kind: 'clear' }
    : undefined,
  drag: {
    kind: 'marquee',
    match: 'touch',
    mode: ctx.mode,
    base: getCurrentSelection(ctx)
  }
})

const planSelectionBoxPress = (
  deps: PolicyDeps,
  ctx: SelectionPressContext
): SelectionPressPlan | undefined => {
  if (!ctx.selected.nodeIds.length && !ctx.selected.edgeIds.length) {
    return undefined
  }

  const selectionBox = canInteractSelectionBox(deps.getSelection())
  if (!selectionBox.interactive || !selectionBox.box) {
    return undefined
  }

  return {
    chrome: true,
    drag: ctx.selected.nodeIds.length > 0
      ? {
          kind: 'move',
          frame: selectionBox.box,
          anchorId: ctx.selected.nodeIds[0]!,
          nodeIds: ctx.selected.nodeIds,
          edgeIds: ctx.selected.edgeIds
        }
      : undefined,
    hold: createContainHoldIntent()
  }
}

const planNodePress = (
  deps: PolicyDeps,
  ctx: SelectionPressContext,
  hitNodeId: NodeId,
  field?: EditField
): SelectionPressPlan | undefined => {
  const nodeId = resolvePressNodeId(deps, ctx, hitNodeId)
  const node = deps.getNode(nodeId)
  const frame = deps.getNodeFrame(nodeId)
  if (!node || !frame) {
    return undefined
  }

  const selectedNodeIds = ctx.selected.nodeIds
  const selectedEdgeIds = ctx.selected.edgeIds
  const selected = isSelectedNode(node.id, selectedNodeIds)
  const repeat =
    ctx.mode === 'replace'
    && isSingleSelectedNode(node.id, selectedNodeIds)
  const dragCurrentSelection = Boolean(
    ctx.mode === 'replace'
    && findNearestGroup(deps, hitNodeId, (groupId) => selectedNodeIds.includes(groupId))
  )
  const select = applyNodeTapSelection(
    selectedNodeIds,
    selectedEdgeIds,
    node.id,
    ctx.mode
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
    dragCurrentSelection && ctx.selected.box
      ? ctx.selected.box
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
  deps: PolicyDeps,
  ctx: SelectionPressContext,
  nodeId: NodeId
): SelectionPressPlan | undefined => {
  const node = deps.getNode(nodeId)
  const frame = deps.getNodeFrame(nodeId)
  if (!node || !frame) {
    return undefined
  }

  const selected = isSelectedNode(node.id, ctx.selected.nodeIds)
  const repeat = ctx.mode === 'replace' && selected
  const select = applyNodeTapSelection(
    ctx.selected.nodeIds,
    ctx.selected.edgeIds,
    node.id,
    ctx.mode
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
          nodeIds: ctx.selected.nodeIds,
          edgeIds: ctx.selected.edgeIds,
          select: toNodeSelection(ctx.selected.nodeIds)
        }
      : {
          kind: 'marquee',
          match: 'touch',
          mode: ctx.mode,
          base: getCurrentSelection(ctx)
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
    box: selection.box
  }
})

export const createSelectionPressPolicy = (
  deps: PolicyDeps
) => ({
  press: (
    ctx: SelectionPressContext
  ): SelectionPressPlan | undefined => {
    const {
      pick,
      field
    } = ctx.input

    if (pick.kind === 'background') {
      return planBackgroundPress(ctx)
    }

    if (pick.kind === 'selection-box' && pick.part === 'body') {
      return planSelectionBoxPress(deps, ctx)
    }

    if (pick.kind === 'node' && pick.part === 'body') {
      return planNodePress(deps, ctx, pick.id, field)
    }

    if (pick.kind === 'node' && pick.part === 'shell') {
      const node = deps.getNode(pick.id)
      const role = node
        ? deps.getNodeRole(node)
        : undefined

      if (role === 'frame') {
        return planNodePress(deps, ctx, pick.id, field)
      }

      if (role === 'group') {
        return planGroupShellPress(deps, ctx, pick.id)
      }
    }

    return undefined
  }
})
