import type { SelectionMode } from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type { EditField } from '../edit'
import type { PointerDown } from '../input/pointer'
import {
  findSelectedGroupId,
  resolvePressNodeId,
  type SelectionPressPolicyDeps
} from './pressRules'

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

const readPressNodeTarget = (
  deps: Pick<SelectionPressPolicyDeps, 'getNode' | 'getOwnerId'>,
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

export const readSelectionPressTarget = (
  deps: SelectionPressPolicyDeps,
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
