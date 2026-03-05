import type { WriteCommandMap } from '@engine-types/command/api'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { Draft } from '../draft'
import { cancelled, invalid, success } from '../draft'
import { corePlan } from '@whiteboard/core/kernel'
import {
  expandNodeSelection
} from '@whiteboard/core/node'
import type {
  Document,
  NodeId,
  Operation
} from '@whiteboard/core/types'
import { createId } from '@whiteboard/core/utils'
import { buildDuplicateSelectionDraft } from '../shared/duplicate'
import { DEFAULT_TUNING } from '../../../../../config'

type SelectionCommand = WriteCommandMap['selection']
type GroupCommand = Extract<SelectionCommand, { type: 'group' }>
type UngroupCommand = Extract<SelectionCommand, { type: 'ungroup' }>
type DeleteCommand = Extract<SelectionCommand, { type: 'delete' }>
type DuplicateCommand = Extract<SelectionCommand, { type: 'duplicate' }>

const toInvalidMessage = (message?: string) =>
  message ?? 'Invalid selection command.'

export const selection = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document' | 'config' | 'registries'>
}) => {
  const readDoc = (): Document => instance.document.get()
  const createGroupId = () => createId('group')
  const createNodeId = () => createId('node')
  const createEdgeId = () => createId('edge')

  const group = (command: GroupCommand): Draft => {
    if (command.selectedNodeIds.length < 2) {
      return cancelled('At least two nodes are required.')
    }

    const planned = corePlan.node.group({
      ids: command.selectedNodeIds,
      doc: readDoc(),
      nodeSize: instance.config.nodeSize,
      createGroupId
    })
    if (!planned.ok) return invalid(toInvalidMessage(planned.message))

    const groupOperation = planned.operations.find(
      (operation): operation is Extract<Operation, { type: 'node.create' }> =>
        operation.type === 'node.create' && operation.node.type === 'group'
    )
    if (!groupOperation) {
      return invalid('Missing group creation operation.')
    }

    return success(planned.operations, {
      selectedNodeIds: [groupOperation.node.id]
    })
  }

  const ungroup = (command: UngroupCommand): Draft => {
    if (!command.selectedNodeIds.length) {
      return cancelled('No nodes selected.')
    }

    const doc = readDoc()
    const selectedSet = new Set(command.selectedNodeIds)
    const groups = doc.nodes.filter(
      (node) => node.type === 'group' && selectedSet.has(node.id)
    )
    if (!groups.length) {
      return cancelled('No groups selected.')
    }

    const operations: Operation[] = []
    for (const groupNode of groups) {
      const planned = corePlan.node.ungroup({
        id: groupNode.id,
        doc
      })
      if (!planned.ok) return invalid(toInvalidMessage(planned.message))
      operations.push(...planned.operations)
    }

    return success(operations, {
      selectedNodeIds: []
    })
  }

  const remove = (command: DeleteCommand): Draft => {
    if (command.selectedEdgeId) {
      return success([{
        type: 'edge.delete',
        id: command.selectedEdgeId
      }], {
        selectedNodeIds: command.selectedNodeIds
      })
    }

    if (!command.selectedNodeIds.length) {
      return cancelled('No nodes selected.')
    }

    const doc = readDoc()
    const { expandedIds } = expandNodeSelection(doc.nodes, command.selectedNodeIds)
    if (!expandedIds.size) {
      return cancelled('No nodes selected.')
    }

    const nodeIds = Array.from(expandedIds)
    const edgeIds = doc.edges
      .filter(
        (edge) =>
          expandedIds.has(edge.source.nodeId)
          || expandedIds.has(edge.target.nodeId)
      )
      .map((edge) => edge.id)

    const operations: Operation[] = [
      ...edgeIds.map((id) => ({
        type: 'edge.delete' as const,
        id
      })),
      ...nodeIds.map((id) => ({
        type: 'node.delete' as const,
        id
      }))
    ]

    return success(operations, {
      selectedNodeIds: []
    })
  }

  const duplicate = (command: DuplicateCommand): Draft => {
    return buildDuplicateSelectionDraft({
      doc: readDoc(),
      selectedNodeIds: command.selectedNodeIds,
      registries: instance.registries,
      createNodeId,
      createEdgeId,
      offset: DEFAULT_TUNING.shortcuts.duplicateOffset
    })
  }

  return (command: SelectionCommand): Draft => {
    switch (command.type) {
      case 'group':
        return group(command)
      case 'ungroup':
        return ungroup(command)
      case 'delete':
        return remove(command)
      case 'duplicate':
        return duplicate(command)
      default:
        return invalid('Unsupported selection action.')
    }
  }
}
