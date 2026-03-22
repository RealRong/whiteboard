import type {
  MindmapWriteOutput,
  WriteCommandMap
} from '@engine-types/command'
import type { WriteInstance } from '@engine-types/write'
import type {
  MindmapCloneSubtreeOptions,
  MindmapCreateOptions,
  MindmapInsertNodeOptions,
  MindmapLayoutConfig,
  MindmapMoveDropOptions,
  MindmapMoveLayoutOptions,
  MindmapMoveRootOptions
} from '@engine-types/mindmap'
import type { Draft } from '../draft'
import { cancelled, invalid, mergeKeepOutput, success } from '../draft'
import { getNode } from '@whiteboard/core/types'
import type {
  Document,
  MindmapAttachPayload,
  MindmapCommandOptions,
  MindmapLayoutHint,
  MindmapId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree
} from '@whiteboard/core/types'
import { createId } from '@whiteboard/core/utils'
import {
  addChild as addMindmapChild,
  addSibling as addMindmapSibling,
  attachExternal as attachMindmapExternal,
  cloneSubtree as cloneMindmapSubtree,
  createDeleteOps,
  createMindmap,
  createSetOp,
  createSetOps,
  moveSubtree as moveMindmapSubtree,
  removeSubtree as removeMindmapSubtree,
  reorderChild as reorderMindmapChild,
  resolveInsertPlan,
  setNodeData as setMindmapNodeData,
  setSide as setMindmapSide,
  toggleCollapse as toggleMindmapCollapse,
  type MindmapCommandResult
} from '@whiteboard/core/mindmap'
import { getMindmapTreeFromDocument } from '@whiteboard/core/mindmap'
import { DEFAULT_TUNING } from '../../config'

type MindmapCommand = WriteCommandMap['mindmap']
type AddSiblingOptions = {
  options?: MindmapCommandOptions
  createNodeId?: () => MindmapNodeId
}

const readMindmap = (doc: Document, id: MindmapId): MindmapTree | undefined =>
  getMindmapTreeFromDocument(doc, id)

const withNodeIdGenerator = <T extends object>(
  createNodeId: () => MindmapNodeId,
  options?: T
) => ({
  ...(options ?? {}),
  idGenerator: {
    nodeId: createNodeId
  }
})

const resolveSlot = (options?: MindmapCommandOptions) => ({
  index: options?.index,
  side: options?.side
})

const runMindmapPlan = <TExtra extends object = {}, TOutput = void>({
  doc,
  id,
  options,
  run,
  select
}: {
  doc: Document
  id: MindmapId
  options?: MindmapCommandOptions
  run: (tree: MindmapTree) => MindmapCommandResult<TExtra>
  select?: (result: { tree: MindmapTree } & TExtra) => TOutput
}): Draft<TOutput> => {
  const beforeTree = readMindmap(doc, id)
  if (!beforeTree) return invalid(`Mindmap ${id} not found.`)

  const next = run(beforeTree)
  if (!next.ok) return invalid(next.error.message, next.error.details)

  return success(
    createSetOps({
      id,
      beforeTree,
      afterTree: next.data.tree,
      hint: options?.layout,
      node: getNode(doc, id)
    }),
    select ? select(next.data) : undefined as TOutput
  )
}

export const mindmap = ({
  instance
}: {
  instance: Pick<WriteInstance, 'document'>
}) => {
  const readDoc = (): Document => instance.document.get()
  const createTreeId = () => createId('mindmap')
  const createNodeId = () => createId('mnode')

  const create = (
    payload?: MindmapCreateOptions
  ): Draft<{ mindmapId: MindmapId; rootId: MindmapNodeId }> => {
    const doc = readDoc()
    if (payload?.id && readMindmap(doc, payload.id)) {
      return invalid(`Mindmap ${payload.id} already exists.`)
    }

    const tree = createMindmap({
      id: payload?.id ?? createTreeId(),
      rootId: payload?.rootId,
      rootData: payload?.rootData,
      idGenerator: {
        treeId: createTreeId,
        nodeId: createNodeId
      }
    })

    return success(
      [createSetOp({ id: tree.id, tree })],
      {
        mindmapId: tree.id,
        rootId: tree.rootId
      }
    )
  }

  const replace = (id: MindmapId, tree: MindmapTree): Draft => {
    const doc = readDoc()
    const beforeTree = readMindmap(doc, id)
    if (!beforeTree) return invalid(`Mindmap ${id} not found.`)
    if (tree.id !== id) return invalid('Mindmap id mismatch.')
    return success([createSetOp({ id, tree })])
  }

  const removeMindmaps = (ids: MindmapId[]): Draft => {
    if (!ids.length) return invalid('No mindmap ids provided.')
    const doc = readDoc()
    for (const id of ids) {
      if (!readMindmap(doc, id)) return invalid(`Mindmap ${id} not found.`)
    }
    return success(createDeleteOps(ids))
  }

  const addChild = (
    id: MindmapId,
    parentId: MindmapNodeId,
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ): Draft<{ nodeId: MindmapNodeId }> =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      options,
      run: (tree) =>
        addMindmapChild(
          tree,
          parentId,
          payload,
          withNodeIdGenerator(createNodeId, resolveSlot(options))
        ),
      select: ({ nodeId }) => ({ nodeId })
    })

  const addSibling = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    position: 'before' | 'after',
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: AddSiblingOptions
  ): Draft<{ nodeId: MindmapNodeId }> =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      options: options?.options,
      run: (tree) =>
        addMindmapSibling(
          tree,
          nodeId,
          position,
          payload,
          withNodeIdGenerator(options?.createNodeId ?? createNodeId)
        ),
      select: ({ nodeId: nextNodeId }) => ({ nodeId: nextNodeId })
    })

  const moveSubtree = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    newParentId: MindmapNodeId,
    options?: MindmapCommandOptions
  ): Draft =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      options,
      run: (tree) =>
        moveMindmapSubtree(tree, nodeId, newParentId, resolveSlot(options))
    })

  const removeSubtree = (id: MindmapId, nodeId: MindmapNodeId): Draft =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      run: (tree) => removeMindmapSubtree(tree, nodeId)
    })

  const cloneSubtree = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    options?: MindmapCloneSubtreeOptions
  ): Draft<{ nodeId: MindmapNodeId; map: Record<MindmapNodeId, MindmapNodeId> }> =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      run: (tree) =>
        cloneMindmapSubtree(
          tree,
          nodeId,
          withNodeIdGenerator(createNodeId, {
            parentId: options?.parentId,
            index: options?.index,
            side: options?.side
          })
        ),
      select: ({ nodeId: clonedNodeId, map }) => ({ nodeId: clonedNodeId, map })
    })

  const toggleCollapse = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    collapsed?: boolean
  ): Draft =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      run: (tree) => toggleMindmapCollapse(tree, nodeId, collapsed)
    })

  const setNodeData = (
    id: MindmapId,
    nodeId: MindmapNodeId,
    patch: Partial<MindmapNodeData>
  ): Draft =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      run: (tree) => setMindmapNodeData(tree, nodeId, patch)
    })

  const reorderChild = (
    id: MindmapId,
    parentId: MindmapNodeId,
    fromIndex: number,
    toIndex: number
  ): Draft =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      run: (tree) => reorderMindmapChild(tree, parentId, fromIndex, toIndex)
    })

  const setSide = (id: MindmapId, nodeId: MindmapNodeId, side: 'left' | 'right'): Draft =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      run: (tree) => setMindmapSide(tree, nodeId, side)
    })

  const attachExternal = (
    id: MindmapId,
    targetId: MindmapNodeId,
    payload: MindmapAttachPayload,
    options?: MindmapCommandOptions
  ): Draft<{ nodeId: MindmapNodeId }> =>
    runMindmapPlan({
      doc: readDoc(),
      id,
      options,
      run: (tree) =>
        attachMindmapExternal(
          tree,
          targetId,
          payload,
          withNodeIdGenerator(createNodeId, resolveSlot(options))
        ),
      select: ({ nodeId }) => ({ nodeId })
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
  }: MindmapInsertNodeOptions): Draft<{ nodeId: MindmapNodeId }> => {
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
      return mergeKeepOutput(
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

  return <C extends MindmapCommand>(command: C): Draft<MindmapWriteOutput<C>> => {
    switch (command.type) {
      case 'create':
        return create(command.payload) as Draft<MindmapWriteOutput<C>>
      case 'replace':
        return replace(command.id, command.tree) as Draft<MindmapWriteOutput<C>>
      case 'delete':
        return removeMindmaps(command.ids) as Draft<MindmapWriteOutput<C>>
      case 'insert.child':
        return addChild(command.id, command.parentId, command.payload, command.options) as Draft<MindmapWriteOutput<C>>
      case 'insert.sibling':
        return addSibling(command.id, command.nodeId, command.position, command.payload, {
          options: command.options
        }) as Draft<MindmapWriteOutput<C>>
      case 'insert.external':
        return attachExternal(command.id, command.targetId, command.payload, command.options) as Draft<MindmapWriteOutput<C>>
      case 'insert.placement':
        return insertPlacement(command) as Draft<MindmapWriteOutput<C>>
      case 'move.subtree':
        return moveSubtree(command.id, command.nodeId, command.newParentId, command.options) as Draft<MindmapWriteOutput<C>>
      case 'move.layout':
        return moveWithLayout(command) as Draft<MindmapWriteOutput<C>>
      case 'move.drop':
        return moveWithDrop(command) as Draft<MindmapWriteOutput<C>>
      case 'move.reorder':
        return reorderChild(command.id, command.parentId, command.fromIndex, command.toIndex) as Draft<MindmapWriteOutput<C>>
      case 'move.root':
        return moveRoot(command) as Draft<MindmapWriteOutput<C>>
      case 'remove':
        return removeSubtree(command.id, command.nodeId) as Draft<MindmapWriteOutput<C>>
      case 'clone.subtree':
        return cloneSubtree(command.id, command.nodeId, command.options) as Draft<MindmapWriteOutput<C>>
      case 'update.data':
        return setNodeData(command.id, command.nodeId, command.patch) as Draft<MindmapWriteOutput<C>>
      case 'update.collapse':
        return toggleCollapse(command.id, command.nodeId, command.collapsed) as Draft<MindmapWriteOutput<C>>
      case 'update.side':
        return setSide(command.id, command.nodeId, command.side) as Draft<MindmapWriteOutput<C>>
      default:
        return invalid('Unsupported mindmap command type.') as Draft<MindmapWriteOutput<C>>
    }
  }
}
