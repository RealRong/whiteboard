import type {
  MindmapCloneSubtreeOptions,
  MindmapCreateOptions
} from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  MindmapAttachPayload,
  MindmapCommandOptions,
  MindmapId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  Operation
} from '@whiteboard/core/types'
import {
  addChild as addMindmapChild,
  addSibling as addMindmapSibling,
  attachExternal as attachMindmapExternal,
  cloneSubtree as cloneMindmapSubtree,
  createCreateOp,
  createDeleteOps,
  createMindmap,
  createReplaceOp,
  createReplaceOps,
  moveSubtree as moveMindmapSubtree,
  removeSubtree as removeMindmapSubtree,
  reorderChild as reorderMindmapChild,
  setNodeData as setMindmapNodeData,
  setSide as setMindmapSide,
  toggleCollapse as toggleMindmapCollapse,
  type MindmapCommandResult
} from '@whiteboard/core/mindmap'
import { createScopedId } from '../../id'

type MindmapInstance = Pick<InternalInstance, 'document' | 'mutate'>

export type BaseMindmapCommands = {
  create: (payload?: MindmapCreateOptions) => Promise<DispatchResult>
  replace: (id: MindmapId, tree: MindmapTree) => Promise<DispatchResult>
  delete: (ids: MindmapId[]) => Promise<DispatchResult>
  addChild: (
    id: MindmapId,
    parentId: MindmapNodeId,
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<DispatchResult>
  addSibling: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    position: 'before' | 'after',
    payload?: MindmapNodeData | MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<DispatchResult>
  moveSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    newParentId: MindmapNodeId,
    options?: MindmapCommandOptions
  ) => Promise<DispatchResult>
  removeSubtree: (id: MindmapId, nodeId: MindmapNodeId) => Promise<DispatchResult>
  cloneSubtree: (
    id: MindmapId,
    nodeId: MindmapNodeId,
    options?: MindmapCloneSubtreeOptions
  ) => Promise<DispatchResult>
  toggleCollapse: (id: MindmapId, nodeId: MindmapNodeId, collapsed?: boolean) => Promise<DispatchResult>
  setNodeData: (id: MindmapId, nodeId: MindmapNodeId, patch: Partial<MindmapNodeData>) => Promise<DispatchResult>
  reorderChild: (id: MindmapId, parentId: MindmapNodeId, fromIndex: number, toIndex: number) => Promise<DispatchResult>
  setSide: (id: MindmapId, nodeId: MindmapNodeId, side: 'left' | 'right') => Promise<DispatchResult>
  attachExternal: (
    id: MindmapId,
    targetId: MindmapNodeId,
    payload: MindmapAttachPayload,
    options?: MindmapCommandOptions
  ) => Promise<DispatchResult>
}

type CreateBaseMindmapCommandsOptions = {
  instance: MindmapInstance
}

type CommandSuccess<T> = Extract<MindmapCommandResult<T>, { ok: true }>

export const createBaseMindmapCommands = ({
  instance
}: CreateBaseMindmapCommandsOptions): BaseMindmapCommands => {
  const createInvalidResult = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })
  const invalid = (message: string): Promise<DispatchResult> =>
    Promise.resolve(createInvalidResult(message))

  const readMindmap = (id: string): MindmapTree | undefined =>
    (instance.document.get().mindmaps ?? []).find((tree) => tree.id === id)
  const readMindmapNode = (id: string) =>
    instance.document.get().nodes.find((node) => node.id === id)

  const hasMindmapId = (id: string) => Boolean(readMindmap(id))
  const hasMindmapNodeId = (id: string) =>
    (instance.document.get().mindmaps ?? []).some((tree) => Boolean(tree.nodes[id as MindmapNodeId]))
  const createMindmapId = () => createScopedId({ prefix: 'mindmap', exists: hasMindmapId })
  const createMindmapNodeId = () => createScopedId({ prefix: 'mnode', exists: hasMindmapNodeId })
  const nodeIdGenerator = { nodeId: createMindmapNodeId }
  const withNodeId = <T extends object>(options?: T) => ({
    ...(options ?? {}),
    idGenerator: nodeIdGenerator
  })

  const runMutationsWithValue = async (
    operations: Operation[],
    value?: unknown
  ): Promise<DispatchResult> => {
    const result = await instance.mutate(operations, 'ui')
    if (!result.ok || typeof value === 'undefined') {
      return result
    }
    return {
      ...result,
      value
    }
  }

  const replaceOps = (
    id: string,
    before: MindmapTree,
    after: MindmapTree,
    layout?: MindmapCommandOptions['layout']
  ) =>
    createReplaceOps({
      id,
      beforeTree: before,
      afterTree: after,
      hint: layout,
      node: readMindmapNode(id)
    })

  const runTreeCommand = <T>({
    id,
    layout,
    execute,
    pickValue
  }: {
    id: MindmapId
    layout?: MindmapCommandOptions['layout']
    execute: (tree: MindmapTree) => MindmapCommandResult<T>
    pickValue?: (result: CommandSuccess<T>) => unknown
  }): Promise<DispatchResult> => {
    const current = readMindmap(id)
    if (!current) {
      return invalid(`Mindmap ${id} not found.`)
    }

    const next = execute(current)
    if (!next.ok) {
      return invalid(next.error)
    }

    return runMutationsWithValue(
      replaceOps(id, current, next.tree, layout),
      pickValue?.(next)
    )
  }

  const create: BaseMindmapCommands['create'] = (payload) => {
    if (payload?.id && readMindmap(payload.id)) {
      return invalid(`Mindmap ${payload.id} already exists.`)
    }
    const mindmap = createMindmap({
      id: payload?.id ?? createMindmapId(),
      rootId: payload?.rootId,
      rootData: payload?.rootData,
      idGenerator: {
        treeId: createMindmapId,
        ...withNodeId()
      }
    })
    return runMutationsWithValue(
      [createCreateOp(mindmap)],
      mindmap.id
    )
  }

  const replace: BaseMindmapCommands['replace'] = (id, tree) => {
    const current = readMindmap(id)
    if (!current) {
      return invalid(`Mindmap ${id} not found.`)
    }
    if (tree.id !== id) {
      return invalid('Mindmap id mismatch.')
    }
    return instance.mutate(
      [createReplaceOp({ id, beforeTree: current, afterTree: tree })],
      'ui'
    )
  }

  const remove: BaseMindmapCommands['delete'] = (ids) => {
    if (!ids.length) {
      return invalid('No mindmap ids provided.')
    }

    const trees: MindmapTree[] = []
    for (const id of ids) {
      const tree = readMindmap(id)
      if (!tree) {
        return invalid(`Mindmap ${id} not found.`)
      }
      trees.push(tree)
    }

    return instance.mutate(
      createDeleteOps(trees),
      'ui'
    )
  }

  const addChild: BaseMindmapCommands['addChild'] = (id, parentId, payload, options) => {
    return runTreeCommand({
      id,
      layout: options?.layout,
      execute: (current) =>
        addMindmapChild(current, parentId, payload, withNodeId({
          index: options?.index,
          side: options?.side
        })),
      pickValue: (next) => next.value?.id
    })
  }

  const addSibling: BaseMindmapCommands['addSibling'] = (id, nodeId, position, payload, options) => {
    return runTreeCommand({
      id,
      layout: options?.layout,
      execute: (current) =>
        addMindmapSibling(current, nodeId, position, payload, withNodeId()),
      pickValue: (next) => next.value?.id
    })
  }

  const moveSubtree: BaseMindmapCommands['moveSubtree'] = (id, nodeId, newParentId, options) => {
    return runTreeCommand({
      id,
      layout: options?.layout,
      execute: (current) =>
        moveMindmapSubtree(current, nodeId, newParentId, {
          index: options?.index,
          side: options?.side
        })
    })
  }

  const removeSubtree: BaseMindmapCommands['removeSubtree'] = (id, nodeId) => {
    return runTreeCommand({
      id,
      execute: (current) => removeMindmapSubtree(current, nodeId)
    })
  }

  const cloneSubtree: BaseMindmapCommands['cloneSubtree'] = (id, nodeId, options) => {
    return runTreeCommand({
      id,
      execute: (current) =>
        cloneMindmapSubtree(current, nodeId, withNodeId({
          parentId: options?.parentId,
          index: options?.index,
          side: options?.side
        })),
      pickValue: (next) => next.value?.id
    })
  }

  const toggleCollapse: BaseMindmapCommands['toggleCollapse'] = (id, nodeId, collapsed) => {
    return runTreeCommand({
      id,
      execute: (current) => toggleMindmapCollapse(current, nodeId, collapsed)
    })
  }

  const setNodeData: BaseMindmapCommands['setNodeData'] = (id, nodeId, patch) => {
    return runTreeCommand({
      id,
      execute: (current) => setMindmapNodeData(current, nodeId, patch)
    })
  }

  const reorderChild: BaseMindmapCommands['reorderChild'] = (id, parentId, fromIndex, toIndex) => {
    return runTreeCommand({
      id,
      execute: (current) => reorderMindmapChild(current, parentId, fromIndex, toIndex)
    })
  }

  const setSide: BaseMindmapCommands['setSide'] = (id, nodeId, side) => {
    return runTreeCommand({
      id,
      execute: (current) => setMindmapSide(current, nodeId, side)
    })
  }

  const attachExternal: BaseMindmapCommands['attachExternal'] = (id, targetId, payload, options) => {
    return runTreeCommand({
      id,
      execute: (current) =>
        attachMindmapExternal(current, targetId, payload, withNodeId({
          index: options?.index,
          side: options?.side
        })),
      pickValue: (next) => next.value?.id
    })
  }

  return {
    create,
    replace,
    delete: remove,
    addChild,
    addSibling,
    moveSubtree,
    removeSubtree,
    cloneSubtree,
    toggleCollapse,
    setNodeData,
    reorderChild,
    setSide,
    attachExternal
  }
}
