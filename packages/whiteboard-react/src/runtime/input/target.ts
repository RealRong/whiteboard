import {
  findGroupAncestor,
  type SelectionMode,
  type SelectionPressTarget as CoreSelectionPressTarget
} from '@whiteboard/core/node'
import type {
  EdgeId,
  Node,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { NodeRole } from '../../types/node'
import type { EditField } from '../edit'
import type { Pick as PointerPick } from '../pick'

export const CanvasContentIgnoreSelector = [
  '[data-selection-ignore]',
  '[data-input-ignore]',
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])'
].join(', ')

export const readEditableFieldTarget = (
  target: EventTarget | null
): EditField | undefined => {
  if (!(target instanceof Element)) return undefined

  const value = target
    .closest('[data-node-editable-field]')
    ?.getAttribute('data-node-editable-field')

  return value === 'text' || value === 'title'
    ? value
    : undefined
}

export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) return true
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
}

export const isInputIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-input-ignore]'))

export const isSelectionIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-selection-ignore]'))

export const isContextMenuIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-context-menu-ignore]'))

export const isKeyboardIgnoredTarget = (target: EventTarget | null) =>
  isEditableTarget(target) || isInputIgnoredTarget(target)

export const isCanvasContentIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(CanvasContentIgnoreSelector))

export type SelectionPressTarget = CoreSelectionPressTarget<EditField>

type PressTargetDeps = {
  getNode: (nodeId: NodeId) => Node | undefined
  getOwnerId: (nodeId: NodeId) => NodeId | undefined
  getNodeRole: (node: Node) => NodeRole
}

type PressTargetInput = {
  pick: PointerPick
  field?: EditField
  mode: SelectionMode
  selectedNodeIds: readonly NodeId[]
}

const findSelectedGroupId = (
  deps: PressTargetDeps,
  nodeId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => findGroupAncestor(
  nodeId,
  deps.getNode,
  deps.getOwnerId,
  (groupId) => selectedNodeIds.includes(groupId)
)

const resolvePressNodeId = (
  deps: PressTargetDeps,
  input: PressTargetInput,
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
  deps: PressTargetDeps,
  input: PressTargetInput,
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

export const readSelectionPressTarget = (
  deps: PressTargetDeps,
  input: PressTargetInput
): SelectionPressTarget | undefined => {
  const { pick } = input

  switch (pick.kind) {
    case 'background':
      return {
        kind: 'background'
      }
    case 'selection-box':
      return pick.part === 'body'
        ? {
            kind: 'selection-box'
          }
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

export type ContextTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; nodeId: NodeId; world: Point }
  | { kind: 'nodes'; nodeIds: readonly NodeId[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

export type ContextResolved =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; node: Node; world: Point }
  | { kind: 'nodes'; nodes: readonly Node[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

type ContextTargetInput = {
  pick: PointerPick
  world: Point
  selectionNodeIds: readonly NodeId[]
  selectionNodeSet: ReadonlySet<NodeId>
  selectionCount: number
}

type ContextResolveDeps = {
  getNode: (nodeId: NodeId) => Node | undefined
  hasEdge: (edgeId: EdgeId) => boolean
}

const readSelectedNodesTarget = (
  nodeId: NodeId,
  input: Pick<ContextTargetInput, 'selectionNodeSet' | 'selectionNodeIds' | 'selectionCount' | 'world'>
): ContextTarget => (
  input.selectionNodeSet.has(nodeId) && input.selectionCount > 1
    ? {
        kind: 'nodes',
        nodeIds: input.selectionNodeIds,
        world: input.world
      }
    : {
        kind: 'node',
        nodeId,
        world: input.world
      }
)

export const readContextTarget = ({
  pick,
  world,
  selectionNodeIds,
  selectionNodeSet,
  selectionCount
}: ContextTargetInput): ContextTarget => {
  switch (pick.kind) {
    case 'selection-box':
      return selectionCount > 1
        ? {
            kind: 'nodes',
            nodeIds: selectionNodeIds,
            world
          }
        : {
            kind: 'canvas',
            world
          }
    case 'node':
      return readSelectedNodesTarget(pick.id, {
        selectionNodeSet,
        selectionNodeIds,
        selectionCount,
        world
      })
    case 'edge':
      return {
        kind: 'edge',
        edgeId: pick.id,
        world
      }
    case 'background':
    case 'mindmap':
      return {
        kind: 'canvas',
        world
      }
  }
}

const resolveNodeList = (
  deps: ContextResolveDeps,
  nodeIds: readonly NodeId[]
): readonly Node[] => nodeIds
  .map((nodeId) => deps.getNode(nodeId))
  .filter((node): node is Node => Boolean(node))

export const resolveContextTarget = (
  deps: ContextResolveDeps,
  target: ContextTarget
): ContextResolved | undefined => {
  switch (target.kind) {
    case 'canvas':
      return target
    case 'node': {
      const node = deps.getNode(target.nodeId)
      if (!node) {
        return undefined
      }

      return {
        kind: 'node',
        node,
        world: target.world
      }
    }
    case 'nodes': {
      const nodes = resolveNodeList(deps, target.nodeIds)
      if (!nodes.length) {
        return undefined
      }

      return {
        kind: 'nodes',
        nodes,
        world: target.world
      }
    }
    case 'edge':
      return deps.hasEdge(target.edgeId)
        ? target
        : undefined
  }
}
