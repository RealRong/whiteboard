import type {
  MindmapApplyCommand,
  MindmapInsertCommand,
  MindmapInsertNodeOptions,
  MindmapMoveCommand,
  MindmapMoveDropOptions,
  MindmapMoveLayoutOptions,
  MindmapMoveRootOptions,
  MindmapUpdateCommand
} from '@engine-types/command/api'
import type { MindmapLayoutConfig } from '@engine-types/mindmap/layout'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { MindmapCommandsApi } from '@engine-types/write/commands'
import type {
  DispatchResult,
  MindmapAttachPayload,
  MindmapLayoutHint,
  MindmapNodeId,
  MindmapNodeData
} from '@whiteboard/core/types'
import { resolveInsertPlan } from '@whiteboard/core/mindmap'
import { DEFAULT_TUNING } from '../../../../config'
import { base } from './base'

type ModeCommand = { mode: string }
type TypeCommand = { type: string }

const dispatchByMode = <U extends ModeCommand>(
  command: U,
  handlers: Partial<{
    [K in U['mode']]: (value: Extract<U, { mode: K }>) => Promise<DispatchResult>
  }>,
  onMissing: () => Promise<DispatchResult>
): Promise<DispatchResult> => {
  const handler = handlers[command.mode as U['mode']] as
    | ((value: U) => Promise<DispatchResult>)
    | undefined
  return handler ? handler(command) : onMissing()
}

const dispatchByType = <U extends TypeCommand>(
  command: U,
  handlers: Partial<{
    [K in U['type']]: (value: Extract<U, { type: K }>) => Promise<DispatchResult>
  }>,
  onMissing: () => Promise<DispatchResult>
): Promise<DispatchResult> => {
  const handler = handlers[command.type as U['type']] as
    | ((value: U) => Promise<DispatchResult>)
    | undefined
  return handler ? handler(command) : onMissing()
}

export const mindmap = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document' | 'mutate'>
}): MindmapCommandsApi => {
  const baseCommands = base({ instance })

  const cancelled = (message?: string): DispatchResult => ({
    ok: false,
    reason: 'cancelled',
    message
  })
  const invalid = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })
  const fail = (message: string): Promise<DispatchResult> =>
    Promise.resolve(invalid(message))
  const layoutHint = (
    anchorId: MindmapNodeId,
    nodeSize: { width: number; height: number },
    layout: MindmapLayoutConfig
  ): MindmapLayoutHint => ({
    nodeSize,
    mode: layout.mode,
    options: layout.options,
    anchorId
  })

  const insertPlacement = async ({
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
    const hint = layoutHint(targetNodeId, nodeSize, layout)
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
        layout: hint
      })
    }

    if (plan.mode === 'sibling') {
      return baseCommands.addSibling(id, plan.nodeId, plan.position, normalizedPayload, {
        layout: hint
      })
    }

    if (plan.mode === 'towardRoot') {
      const result = await baseCommands.addSibling(id, plan.nodeId, 'before', normalizedPayload, {
        layout: hint
      })
      if (!result.ok || typeof result.value !== 'string') return result
      return baseCommands.moveSubtree(id, targetNodeId, result.value, {
        index: 0,
        layout: layoutHint(result.value, nodeSize, layout)
      })
    }

    return invalid('Unsupported insert plan.')
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
      layout: layoutHint(newParentId, nodeSize, layout)
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
    if (!shouldMove) return cancelled('No subtree movement required.')

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
      return cancelled(`Node ${nodeId} not found.`)
    }
    if (
      Math.abs(node.position.x - position.x) < threshold &&
      Math.abs(node.position.y - position.y) < threshold
    ) {
      return cancelled('Root movement is below threshold.')
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

  const insertHandlers = {
    child: (command) =>
      baseCommands.addChild(command.id, command.parentId, command.payload, command.options),
    sibling: (command) =>
      baseCommands.addSibling(command.id, command.nodeId, command.position, command.payload, command.options),
    external: (command) =>
      baseCommands.attachExternal(command.id, command.targetId, command.payload, command.options),
    placement: insertPlacement
  } satisfies {
    [K in MindmapInsertCommand['mode']]: (
      value: Extract<MindmapInsertCommand, { mode: K }>
    ) => Promise<DispatchResult>
  }

  const moveHandlers = {
    direct: (command) =>
      baseCommands.moveSubtree(command.id, command.nodeId, command.newParentId, command.options),
    layout: moveWithLayout,
    drop: moveWithDrop,
    reorder: (command) =>
      baseCommands.reorderChild(command.id, command.parentId, command.fromIndex, command.toIndex)
  } satisfies {
    [K in MindmapMoveCommand['mode']]: (
      value: Extract<MindmapMoveCommand, { mode: K }>
    ) => Promise<DispatchResult>
  }

  const updateHandlers = {
    data: (command) =>
      baseCommands.setNodeData(command.id, command.nodeId, command.patch),
    collapse: (command) =>
      baseCommands.toggleCollapse(command.id, command.nodeId, command.collapsed),
    side: (command) =>
      baseCommands.setSide(command.id, command.nodeId, command.side)
  } satisfies {
    [K in MindmapUpdateCommand['mode']]: (
      value: Extract<MindmapUpdateCommand, { mode: K }>
    ) => Promise<DispatchResult>
  }

  const handlers = {
    create: (command) => baseCommands.create(command.payload),
    replace: (command) => baseCommands.replace(command.id, command.tree),
    delete: (command) => baseCommands.delete(command.ids),
    insert: (command) =>
      dispatchByMode(
        command,
        insertHandlers,
        () => fail('Unsupported insert mode.')
      ),
    move: (command) =>
      dispatchByMode(
        command,
        moveHandlers,
        () => fail('Unsupported move mode.')
      ),
    remove: (command) => baseCommands.removeSubtree(command.id, command.nodeId),
    clone: (command) => baseCommands.cloneSubtree(command.id, command.nodeId, command.options),
    update: (command) =>
      dispatchByMode(
        command,
        updateHandlers,
        () => fail('Unsupported update mode.')
      ),
    root: moveRootByPosition
  } satisfies {
    [K in MindmapApplyCommand['type']]: (
      value: Extract<MindmapApplyCommand, { type: K }>
    ) => Promise<DispatchResult>
  }

  const apply: MindmapCommandsApi['apply'] = (command) =>
    dispatchByType(
      command,
      handlers,
      () => fail('Unsupported mindmap command type.')
    )

  return {
    apply
  }
}
