import type {
  MindmapCreateOptions,
  MindmapInsertCommand,
  MindmapInsertNodeOptions,
  MindmapCloneSubtreeOptions,
  MindmapMoveCommand,
  MindmapMoveDropOptions,
  MindmapMoveLayoutOptions,
  MindmapMoveRootOptions,
  MindmapUpdateCommand
} from '@engine-types/command/api'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { MindmapLayoutConfig } from '@engine-types/mindmap/layout'
import type { Draft, MindmapCommand } from '../model'
import { cancelled, invalid, ops, success } from '../model'
import type {
  MindmapAttachPayload,
  MindmapCommandOptions,
  MindmapLayoutHint,
  MindmapId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  Operation
} from '@whiteboard/core/types'
import { resolveInsertPlan } from '@whiteboard/core/mindmap'
import { corePlan } from '@whiteboard/core/kernel'
import { DEFAULT_TUNING } from '../../../config'
import { createScopedId } from '../id'

const merge = (...drafts: Draft[]): Draft => {
  const operations: Operation[] = []
  let value: unknown = undefined
  for (const draft of drafts) {
    if (!draft.ok) return draft
    operations.push(...draft.operations)
    if (typeof draft.value !== 'undefined') {
      value = draft.value
    }
  }
  return success(operations, value)
}

export const mindmap = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document'>
}) => {
  const readDoc = () => instance.document.get()
  const hasMindmapId = (id: string) =>
    Boolean(readDoc().mindmaps?.some((tree) => tree.id === id))
  const hasMindmapNodeId = (id: string) =>
    Boolean(
      readDoc().mindmaps?.some((tree) => Boolean(tree.nodes[id as MindmapNodeId]))
    )
  const createTreeId = () =>
    createScopedId({ prefix: 'mindmap', exists: hasMindmapId })
  const createNodeId = () =>
    createScopedId({ prefix: 'mnode', exists: hasMindmapNodeId })

  const plans = {
    create: (payload?: MindmapCreateOptions): Draft =>
      ops(
        corePlan.mindmap.create({
          payload,
          doc: readDoc(),
          createTreeId,
          createNodeId
        })
      ),

    replace: (id: MindmapId, tree: MindmapTree): Draft =>
      ops(
        corePlan.mindmap.replace({
          id,
          tree,
          doc: readDoc()
        })
      ),

    delete: (ids: MindmapId[]): Draft =>
      ops(
        corePlan.mindmap.delete({
          ids,
          doc: readDoc()
        })
      ),

    addChild: (
      id: MindmapId,
      parentId: MindmapNodeId,
      payload?: MindmapNodeData | MindmapAttachPayload,
      options?: MindmapCommandOptions
    ): Draft =>
      ops(
        corePlan.mindmap.addChild({
          id,
          parentId,
          payload,
          options,
          doc: readDoc(),
          createNodeId
        })
      ),

    addSibling: (
      id: MindmapId,
      nodeId: MindmapNodeId,
      position: 'before' | 'after',
      payload?: MindmapNodeData | MindmapAttachPayload,
      options?: MindmapCommandOptions
    ): Draft =>
      ops(
        corePlan.mindmap.addSibling({
          id,
          nodeId,
          position,
          payload,
          options,
          doc: readDoc(),
          createNodeId
        })
      ),

    moveSubtree: (
      id: MindmapId,
      nodeId: MindmapNodeId,
      newParentId: MindmapNodeId,
      options?: MindmapCommandOptions
    ): Draft =>
      ops(
        corePlan.mindmap.moveSubtree({
          id,
          nodeId,
          newParentId,
          options,
          doc: readDoc()
        })
      ),

    removeSubtree: (id: MindmapId, nodeId: MindmapNodeId): Draft =>
      ops(
        corePlan.mindmap.removeSubtree({
          id,
          nodeId,
          doc: readDoc()
        })
      ),

    cloneSubtree: (
      id: MindmapId,
      nodeId: MindmapNodeId,
      options?: MindmapCloneSubtreeOptions
    ): Draft =>
      ops(
        corePlan.mindmap.cloneSubtree({
          id,
          nodeId,
          options,
          doc: readDoc(),
          createNodeId
        })
      ),

    toggleCollapse: (
      id: MindmapId,
      nodeId: MindmapNodeId,
      collapsed?: boolean
    ): Draft =>
      ops(
        corePlan.mindmap.toggleCollapse({
          id,
          nodeId,
          collapsed,
          doc: readDoc()
        })
      ),

    setNodeData: (
      id: MindmapId,
      nodeId: MindmapNodeId,
      patch: Partial<MindmapNodeData>
    ): Draft =>
      ops(
        corePlan.mindmap.setNodeData({
          id,
          nodeId,
          patch,
          doc: readDoc()
        })
      ),

    reorderChild: (
      id: MindmapId,
      parentId: MindmapNodeId,
      fromIndex: number,
      toIndex: number
    ): Draft =>
      ops(
        corePlan.mindmap.reorderChild({
          id,
          parentId,
          fromIndex,
          toIndex,
          doc: readDoc()
        })
      ),

    setSide: (id: MindmapId, nodeId: MindmapNodeId, side: 'left' | 'right'): Draft =>
      ops(
        corePlan.mindmap.setSide({
          id,
          nodeId,
          side,
          doc: readDoc()
        })
      ),

    attachExternal: (
      id: MindmapId,
      targetId: MindmapNodeId,
      payload: MindmapAttachPayload,
      options?: MindmapCommandOptions
    ): Draft =>
      ops(
        corePlan.mindmap.attachExternal({
          id,
          targetId,
          payload,
          options,
          doc: readDoc(),
          createNodeId
        })
      )
  }

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

  const insertPlacement = ({
    id,
    tree,
    targetNodeId,
    placement,
    nodeSize,
    layout,
    payload
  }: MindmapInsertNodeOptions): Draft => {
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
      return plans.addChild(id, plan.parentId, normalizedPayload, {
        index: plan.index,
        side: plan.side,
        layout: hint
      })
    }

    if (plan.mode === 'sibling') {
      return plans.addSibling(id, plan.nodeId, plan.position, normalizedPayload, {
        layout: hint
      })
    }

    if (plan.mode === 'towardRoot') {
      const add = plans.addSibling(id, plan.nodeId, 'before', normalizedPayload, {
        layout: hint
      })
      if (!add.ok || typeof add.value !== 'string') return add
      return merge(
        add,
        plans.moveSubtree(id, targetNodeId, add.value, {
          index: 0,
          layout: layoutHint(add.value, nodeSize, layout)
        })
      )
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
  }: MindmapMoveLayoutOptions): Draft =>
    plans.moveSubtree(id, nodeId, newParentId, {
      index,
      side,
      layout: layoutHint(newParentId, nodeSize, layout)
    })

  const moveWithDrop = ({
    id,
    nodeId,
    drop,
    origin,
    nodeSize,
    layout
  }: MindmapMoveDropOptions): Draft => {
    const shouldMove =
      drop.parentId !== origin?.parentId ||
      drop.index !== origin?.index ||
      typeof drop.side !== 'undefined'
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

  const moveRootByPosition = ({
    nodeId,
    position,
    threshold = DEFAULT_TUNING.mindmap.rootMoveThreshold
  }: MindmapMoveRootOptions): Draft => {
    const node = readDoc().nodes.find((item) => item.id === nodeId)
    if (!node) {
      return cancelled(`Node ${nodeId} not found.`)
    }
    if (
      Math.abs(node.position.x - position.x) < threshold &&
      Math.abs(node.position.y - position.y) < threshold
    ) {
      return cancelled('Root movement is below threshold.')
    }

    return success([{
      type: 'node.update',
      id: nodeId,
      patch: {
        position: { x: position.x, y: position.y }
      }
    }])
  }

  const applyInsert = (command: MindmapInsertCommand): Draft => {
    switch (command.mode) {
      case 'child':
        return plans.addChild(command.id, command.parentId, command.payload, command.options)
      case 'sibling':
        return plans.addSibling(command.id, command.nodeId, command.position, command.payload, command.options)
      case 'external':
        return plans.attachExternal(command.id, command.targetId, command.payload, command.options)
      case 'placement':
        return insertPlacement(command)
      default:
        return invalid('Unsupported insert mode.')
    }
  }

  const applyMove = (command: MindmapMoveCommand): Draft => {
    switch (command.mode) {
      case 'direct':
        return plans.moveSubtree(command.id, command.nodeId, command.newParentId, command.options)
      case 'layout':
        return moveWithLayout(command)
      case 'drop':
        return moveWithDrop(command)
      case 'reorder':
        return plans.reorderChild(command.id, command.parentId, command.fromIndex, command.toIndex)
      default:
        return invalid('Unsupported move mode.')
    }
  }

  const applyUpdate = (command: MindmapUpdateCommand): Draft => {
    switch (command.mode) {
      case 'data':
        return plans.setNodeData(command.id, command.nodeId, command.patch)
      case 'collapse':
        return plans.toggleCollapse(command.id, command.nodeId, command.collapsed)
      case 'side':
        return plans.setSide(command.id, command.nodeId, command.side)
      default:
        return invalid('Unsupported update mode.')
    }
  }

  const applyCommand = (command: MindmapCommand): Draft => {
    switch (command.type) {
      case 'create':
        return plans.create(command.payload)
      case 'replace':
        return plans.replace(command.id, command.tree)
      case 'delete':
        return plans.delete(command.ids)
      case 'insert':
        return applyInsert(command)
      case 'move':
        return applyMove(command)
      case 'remove':
        return plans.removeSubtree(command.id, command.nodeId)
      case 'clone':
        return plans.cloneSubtree(command.id, command.nodeId, command.options)
      case 'update':
        return applyUpdate(command)
      case 'root':
        return moveRootByPosition(command)
      default:
        return invalid('Unsupported mindmap command type.')
    }
  }

  return (command: MindmapCommand): Draft =>
    applyCommand(command)
}
