import type {
  Commands,
  MindmapInsertNodeOptions,
  MindmapMoveDropOptions,
  MindmapMoveLayoutOptions,
  MindmapMoveRootOptions
} from '@engine-types/commands'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  MindmapAttachPayload,
  MindmapLayoutHint,
  MindmapNodeId,
  MindmapNodeData
} from '@whiteboard/core/types'
import { resolveInsertPlan } from '@whiteboard/core/mindmap'
import { DEFAULT_TUNING } from '../../../../config'
import { createBaseMindmapCommands } from './base'

type Options = {
  instance: Pick<InternalInstance, 'document' | 'mutate'>
}

export type MindmapCommandsApi = Commands['mindmap'] & {
  readonly name: 'Mindmap'
}

type MindmapApply = Commands['mindmap']['apply']

export const createMindmapCommands = ({ instance }: Options): MindmapCommandsApi => {
  const baseCommands = createBaseMindmapCommands({ instance })

  const createCancelledResult = (message?: string): DispatchResult => ({
    ok: false,
    reason: 'cancelled',
    message
  })
  const createInvalidResult = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })
  const toLayoutHint = (
    anchorId: MindmapNodeId,
    nodeSize: { width: number; height: number },
    layout: MindmapLayoutConfig
  ): MindmapLayoutHint => ({
    nodeSize,
    mode: layout.mode,
    options: layout.options,
    anchorId
  })

  const insertByPlacement = async ({
    id,
    tree,
    targetNodeId,
    placement,
    nodeSize,
    layout,
    payload
  }: MindmapInsertNodeOptions): Promise<DispatchResult> => {
    const normalizedPayload: MindmapNodeData | MindmapAttachPayload = payload ?? {
      kind: 'text',
      text: ''
    }
    const layoutHint = toLayoutHint(targetNodeId, nodeSize, layout)
    const plan = resolveInsertPlan({
      tree,
      targetNodeId,
      placement,
      layoutSide: layout.options?.side,
      defaultSide: DEFAULT_TUNING.mindmap.defaultSide
    })

    if (plan.mode === 'child') {
      return baseCommands.addChild(id, plan.parentId, normalizedPayload, {
        index: plan.index,
        side: plan.side,
        layout: layoutHint
      })
    }

    if (plan.mode === 'sibling') {
      return baseCommands.addSibling(id, plan.nodeId, plan.position, normalizedPayload, {
        layout: layoutHint
      })
    }

    if (plan.mode === 'towardRoot') {
      const result = await baseCommands.addSibling(id, plan.nodeId, 'before', normalizedPayload, {
        layout: layoutHint
      })
      if (!result.ok || typeof result.value !== 'string') return result
      return baseCommands.moveSubtree(id, targetNodeId, result.value, {
        index: 0,
        layout: toLayoutHint(result.value, nodeSize, layout)
      })
    }

    return createInvalidResult('Unsupported insert plan.')
  }

  const moveWithLayout = ({
    id,
    nodeId,
    newParentId,
    index,
    side,
    nodeSize,
    layout
  }: MindmapMoveLayoutOptions): Promise<DispatchResult> =>
    baseCommands.moveSubtree(id, nodeId, newParentId, {
      index,
      side,
      layout: toLayoutHint(newParentId, nodeSize, layout)
    })

  const moveWithDrop = async ({
    id,
    nodeId,
    drop,
    origin,
    nodeSize,
    layout
  }: MindmapMoveDropOptions): Promise<DispatchResult> => {
    const shouldMove =
      drop.parentId !== origin?.parentId || drop.index !== origin?.index || typeof drop.side !== 'undefined'
    if (!shouldMove) return createCancelledResult('No subtree movement required.')

    return moveWithLayout({
      id,
      nodeId,
      newParentId: drop.parentId,
      index: drop.index,
      side: drop.side,
      nodeSize,
      layout
    })
  }

  const moveRootByPosition = async ({
    nodeId,
    position,
    threshold = DEFAULT_TUNING.mindmap.rootMoveThreshold
  }: MindmapMoveRootOptions): Promise<DispatchResult> => {
    const node = instance.document.get().nodes.find((item) => item.id === nodeId)
    if (!node) {
      return createCancelledResult(`Node ${nodeId} not found.`)
    }
    if (
      Math.abs(node.position.x - position.x) < threshold &&
      Math.abs(node.position.y - position.y) < threshold
    ) {
      return createCancelledResult('Root movement is below threshold.')
    }

    return instance.mutate(
      [{
        type: 'node.update',
        id: nodeId,
        patch: {
          position: { x: position.x, y: position.y }
        }
      }],
      'ui'
    )
  }

  const apply: MindmapApply = async (command) => {
    switch (command.type) {
      case 'create':
        return baseCommands.create(command.payload)
      case 'replace':
        return baseCommands.replace(command.id, command.tree)
      case 'delete':
        return baseCommands.delete(command.ids)
      case 'insert':
        switch (command.mode) {
          case 'child':
            return baseCommands.addChild(command.id, command.parentId, command.payload, command.options)
          case 'sibling':
            return baseCommands.addSibling(command.id, command.nodeId, command.position, command.payload, command.options)
          case 'external':
            return baseCommands.attachExternal(command.id, command.targetId, command.payload, command.options)
          case 'placement':
            return insertByPlacement(command)
          default:
            return createInvalidResult('Unsupported insert mode.')
        }
      case 'move':
        switch (command.mode) {
          case 'direct':
            return baseCommands.moveSubtree(command.id, command.nodeId, command.newParentId, command.options)
          case 'layout':
            return moveWithLayout(command)
          case 'drop':
            return moveWithDrop(command)
          case 'reorder':
            return baseCommands.reorderChild(command.id, command.parentId, command.fromIndex, command.toIndex)
          default:
            return createInvalidResult('Unsupported move mode.')
        }
      case 'remove':
        return baseCommands.removeSubtree(command.id, command.nodeId)
      case 'clone':
        return baseCommands.cloneSubtree(command.id, command.nodeId, command.options)
      case 'update':
        switch (command.mode) {
          case 'data':
            return baseCommands.setNodeData(command.id, command.nodeId, command.patch)
          case 'collapse':
            return baseCommands.toggleCollapse(command.id, command.nodeId, command.collapsed)
          case 'side':
            return baseCommands.setSide(command.id, command.nodeId, command.side)
          default:
            return createInvalidResult('Unsupported update mode.')
        }
      case 'root':
        return moveRootByPosition(command)
      default:
        return createInvalidResult('Unsupported mindmap command type.')
    }
  }

  return {
    name: 'Mindmap',
    apply
  }
}
