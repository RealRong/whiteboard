import type {
  MindmapCreateOptions,
  MindmapInsertNodeOptions,
  MindmapCloneSubtreeOptions,
  MindmapMoveDropOptions,
  MindmapMoveLayoutOptions,
  MindmapMoveRootOptions,
  WriteCommandMap
} from '@engine-types/command/api'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { MindmapLayoutConfig } from '@engine-types/mindmap/layout'
import type { Draft } from '../draft'
import { cancelled, invalid, merge, ops, success } from '../draft'
import { getNode } from '@whiteboard/core/types'
import type {
  Document,
  Operation,
  MindmapAttachPayload,
  MindmapCommandOptions,
  MindmapLayoutHint,
  MindmapId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree
} from '@whiteboard/core/types'
import { createId } from '@whiteboard/core/utils'
import { resolveInsertPlan } from '@whiteboard/core/mindmap'
import { corePlan } from '@whiteboard/core/kernel'
import { DEFAULT_TUNING } from '../../../../../config'

type MindmapCommand = WriteCommandMap['mindmap']
type PlanLike =
  | {
      ok: true
      operations: readonly Operation[]
    }
  | {
      ok: false
      message?: string
    }

type AddSiblingOptions = {
  options?: MindmapCommandOptions
  createNodeId?: () => MindmapNodeId
}

export const mindmap = ({
  instance
}: {
  instance: Pick<InternalInstance, 'document'>
}) => {
  const readDoc = (): Document => instance.document.get()
  const createTreeId = () => createId('mindmap')
  const createNodeId = () => createId('mnode')

  const run = <T extends PlanLike>(build: (doc: Document) => T): Draft =>
    ops(build(readDoc()))

  const withDoc = <TArgs extends { doc: Document }, TResult extends PlanLike>(
    build: (args: TArgs) => TResult
  ) =>
    (args: Omit<TArgs, 'doc'>): Draft =>
      run((doc) => build({ ...(args as object), doc } as TArgs))

  const planCreate = withDoc(corePlan.mindmap.create)
  const planReplace = withDoc(corePlan.mindmap.replace)
  const planDelete = withDoc(corePlan.mindmap.delete)
  const planAddChild = withDoc(corePlan.mindmap.addChild)
  const planAddSibling = withDoc(corePlan.mindmap.addSibling)
  const planMoveSubtree = withDoc(corePlan.mindmap.moveSubtree)
  const planRemoveSubtree = withDoc(corePlan.mindmap.removeSubtree)
  const planCloneSubtree = withDoc(corePlan.mindmap.cloneSubtree)
  const planToggleCollapse = withDoc(corePlan.mindmap.toggleCollapse)
  const planSetNodeData = withDoc(corePlan.mindmap.setNodeData)
  const planReorderChild = withDoc(corePlan.mindmap.reorderChild)
  const planSetSide = withDoc(corePlan.mindmap.setSide)
  const planAttachExternal = withDoc(corePlan.mindmap.attachExternal)

  const create = (payload?: MindmapCreateOptions): Draft =>
    planCreate({
      payload,
      createTreeId,
      createNodeId
    })

  const replace = (id: MindmapId, tree: MindmapTree): Draft =>
    planReplace({ id, tree })

  const removeMindmaps = (ids: MindmapId[]): Draft =>
    planDelete({ ids })

  const addChild = (
    id: MindmapId,
    parentId: MindmapNodeId,
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ): Draft =>
    planAddChild({
      id,
      parentId,
      payload,
      options,
      createNodeId
    })

  const addSibling = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    position: 'before' | 'after',
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: AddSiblingOptions
  ): Draft =>
    planAddSibling({
      id,
      nodeId,
      position,
      payload,
      options: options?.options,
      createNodeId: options?.createNodeId ?? createNodeId
    })

  const moveSubtree = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    newParentId: MindmapNodeId,
    options?: MindmapCommandOptions
  ): Draft =>
    planMoveSubtree({
      id,
      nodeId,
      newParentId,
      options
    })

  const removeSubtree = (id: MindmapId, nodeId: MindmapNodeId): Draft =>
    planRemoveSubtree({ id, nodeId })

  const cloneSubtree = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    options?: MindmapCloneSubtreeOptions
  ): Draft =>
    planCloneSubtree({
      id,
      nodeId,
      options,
      createNodeId
    })

  const toggleCollapse = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    collapsed?: boolean
  ): Draft =>
    planToggleCollapse({
      id,
      nodeId,
      collapsed
    })

  const setNodeData = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    patch: Partial<MindmapNodeData>
  ): Draft =>
    planSetNodeData({
      id,
      nodeId,
      patch
    })

  const reorderChild = (
    id: MindmapId,
    parentId: MindmapNodeId,
    fromIndex: number,
    toIndex: number
  ): Draft =>
    planReorderChild({
      id,
      parentId,
      fromIndex,
      toIndex
    })

  const setSide = (id: MindmapId, nodeId: MindmapNodeId, side: 'left' | 'right'): Draft =>
    planSetSide({
      id,
      nodeId,
      side
    })

  const attachExternal = (
    id: MindmapId,
    targetId: MindmapNodeId,
    payload: MindmapAttachPayload,
    options?: MindmapCommandOptions
  ): Draft =>
    planAttachExternal({
      id,
      targetId,
      payload,
      options,
      createNodeId
    })

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
      return addChild(id, plan.parentId, normalizedPayload, {
        index: plan.index,
        side: plan.side,
        layout: hint
      })
    }

    if (plan.mode === 'sibling') {
      return addSibling(id, plan.nodeId, plan.position, normalizedPayload, {
        options: {
          layout: hint
        }
      })
    }

    if (plan.mode === 'towardRoot') {
      const insertedNodeId = createNodeId()
      return merge(
        addSibling(id, plan.nodeId, 'before', normalizedPayload, {
          options: {
            layout: hint
          },
          createNodeId: () => insertedNodeId
        }),
        moveSubtree(id, targetNodeId, insertedNodeId, {
          index: 0,
          layout: layoutHint(insertedNodeId, nodeSize, layout)
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
    moveSubtree(id, nodeId, newParentId, {
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
      drop.parentId !== origin?.parentId
      || drop.index !== origin?.index
      || typeof drop.side !== 'undefined'
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

  const moveRoot = ({
    nodeId,
    position,
    threshold = DEFAULT_TUNING.mindmap.rootMoveThreshold
  }: MindmapMoveRootOptions): Draft => {
    const node = getNode(readDoc(), nodeId)
    if (!node) {
      return cancelled(`Node ${nodeId} not found.`)
    }
    if (
      Math.abs(node.position.x - position.x) < threshold
      && Math.abs(node.position.y - position.y) < threshold
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

  return (command: MindmapCommand): Draft => {
    switch (command.type) {
      case 'create':
        return create(command.payload)
      case 'replace':
        return replace(command.id, command.tree)
      case 'delete':
        return removeMindmaps(command.ids)
      case 'insert.child':
        return addChild(command.id, command.parentId, command.payload, command.options)
      case 'insert.sibling':
        return addSibling(command.id, command.nodeId, command.position, command.payload, {
          options: command.options
        })
      case 'insert.external':
        return attachExternal(command.id, command.targetId, command.payload, command.options)
      case 'insert.placement':
        return insertPlacement(command)
      case 'move.subtree':
        return moveSubtree(command.id, command.nodeId, command.newParentId, command.options)
      case 'move.layout':
        return moveWithLayout(command)
      case 'move.drop':
        return moveWithDrop(command)
      case 'move.reorder':
        return reorderChild(command.id, command.parentId, command.fromIndex, command.toIndex)
      case 'move.root':
        return moveRoot(command)
      case 'remove':
        return removeSubtree(command.id, command.nodeId)
      case 'clone.subtree':
        return cloneSubtree(command.id, command.nodeId, command.options)
      case 'update.data':
        return setNodeData(command.id, command.nodeId, command.patch)
      case 'update.collapse':
        return toggleCollapse(command.id, command.nodeId, command.collapsed)
      case 'update.side':
        return setSide(command.id, command.nodeId, command.side)
      default:
        return invalid('Unsupported mindmap command type.')
    }
  }
}
