import { getRectsBoundingRect } from '../geometry'
import type {
  EdgeId,
  Node,
  NodeId,
  Rect
} from '../types'
import { getGroupDescendants } from './group'

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export type SelectionModifiers = {
  alt: boolean
  shift: boolean
  ctrl: boolean
  meta: boolean
}

type SelectionModifierEventLike = {
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

const toSelectionModifiers = (
  modifiers: SelectionModifiers | SelectionModifierEventLike
): SelectionModifiers => {
  if ('alt' in modifiers) {
    return modifiers
  }
  return {
    alt: modifiers.altKey,
    shift: modifiers.shiftKey,
    ctrl: modifiers.ctrlKey,
    meta: modifiers.metaKey
  }
}

export const resolveSelectionMode = (
  modifiers: SelectionModifiers | SelectionModifierEventLike
): SelectionMode => {
  const normalized = toSelectionModifiers(modifiers)
  if (normalized.alt) return 'subtract'
  if (normalized.meta || normalized.ctrl) return 'toggle'
  if (normalized.shift) return 'add'
  return 'replace'
}

export const applySelection = <T>(
  prevSelectedIds: Set<T>,
  ids: T[],
  mode: SelectionMode
): Set<T> => {
  if (mode === 'replace') {
    return new Set(ids)
  }

  const next = new Set(prevSelectedIds)
  if (mode === 'add') {
    ids.forEach((id) => next.add(id))
    return next
  }

  if (mode === 'subtract') {
    ids.forEach((id) => next.delete(id))
    return next
  }

  ids.forEach((id) => {
    if (next.has(id)) {
      next.delete(id)
      return
    }
    next.add(id)
  })
  return next
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

export type SelectionPressIntent<TField extends string = string> =
  | { kind: 'clear' }
  | {
      kind: 'select'
      selection: SelectionIds
      match?: SelectionTapMatch
    }
  | {
      kind: 'edit'
      nodeId: NodeId
      field: TField
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

export type SelectionPressPlan<TField extends string = string> = {
  chrome: boolean
  tap?: SelectionPressIntent<TField>
  drag?: SelectionPressIntent<TField>
  hold?: SelectionPressIntent<TField>
}

export type SelectionPressInput<TField extends string = string> = {
  target: SelectionPressTarget<TField>
  mode: SelectionMode
  selected: SelectionPressSelection
}

type SelectionPressDeps = {
  getNode: (nodeId: NodeId) => Node | undefined
  getNodeFrame: (nodeId: NodeId) => Rect | undefined
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

const createContainHoldIntent = <TField extends string>():
SelectionPressIntent<TField> => ({
  kind: 'marquee',
  match: 'contain',
  mode: 'replace',
  base: EMPTY_SELECTION
})

const planBackgroundPress = <TField extends string>(
  input: SelectionPressInput<TField>
): SelectionPressPlan<TField> => ({
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

const planSelectionBoxPress = <TField extends string>(
  input: SelectionPressInput<TField>
): SelectionPressPlan<TField> | undefined => {
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

const planNodePress = <TField extends string>(
  deps: SelectionPressDeps,
  input: SelectionPressInput<TField>,
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

const planGroupShellPress = <TField extends string>(
  deps: SelectionPressDeps,
  input: SelectionPressInput<TField>,
  nodeId: NodeId
): SelectionPressPlan<TField> | undefined => {
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

export const resolveSelectionPressPlan = <TField extends string>(
  deps: SelectionPressDeps,
  input: SelectionPressInput<TField>
): SelectionPressPlan<TField> | undefined => {
  switch (input.target.kind) {
    case 'background':
      return planBackgroundPress(input)
    case 'selection-box':
      return planSelectionBoxPress(input)
    case 'node':
      return planNodePress(deps, input, input.target)
    case 'group-shell':
      return planGroupShellPress(deps, input, input.target.nodeId)
  }
}

export type TargetBoundsInput = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
  groups?: 'node' | 'content'
}

export const getTargetBounds = ({
  input,
  nodes,
  readNodeBounds,
  readEdgeBounds
}: {
  input: TargetBoundsInput
  nodes: readonly Node[]
  readNodeBounds: (nodeId: NodeId) => Rect | undefined
  readEdgeBounds: (edgeId: EdgeId) => Rect | undefined
}): Rect | undefined => {
  const nodeIds = input.nodeIds ?? []
  const edgeIds = input.edgeIds ?? []
  if (!nodeIds.length && !edgeIds.length) {
    return undefined
  }

  const groupMode = input.groups ?? 'node'
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const rectNodeIds = new Set<NodeId>()
  const rects: Rect[] = []

  const pushNodeRect = (nodeId: NodeId) => {
    if (rectNodeIds.has(nodeId)) {
      return
    }

    const rect = readNodeBounds(nodeId)
    if (!rect) {
      return
    }

    rectNodeIds.add(nodeId)
    rects.push(rect)
  }

  nodeIds.forEach((nodeId) => {
    const node = nodeById.get(nodeId)
    if (!node || groupMode !== 'content' || node.type !== 'group') {
      pushNodeRect(nodeId)
      return
    }

    const descendants = getGroupDescendants(nodes, node.id)
    const content = descendants.filter((descendant) => descendant.type !== 'group')
    if (!content.length) {
      pushNodeRect(node.id)
      return
    }

    content.forEach((descendant) => {
      pushNodeRect(descendant.id)
    })
  })

  edgeIds.forEach((edgeId) => {
    const rect = readEdgeBounds(edgeId)
    if (rect) {
      rects.push(rect)
    }
  })

  return getRectsBoundingRect(rects)
}
