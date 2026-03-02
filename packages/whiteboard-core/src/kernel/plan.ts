import type {
  CoreRegistries,
  CoreResult,
  Document,
  MindmapAttachPayload,
  MindmapCommandOptions,
  MindmapCreateInput,
  MindmapId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  NodeInput,
  Operation,
  Point,
  Size,
  Viewport
} from '../types'
import {
  buildNodeCreateOperation,
  buildNodeGroupOperations,
  buildNodeUngroupOperations
} from '../node'
import { buildEdgeCreateOperation } from '../edge'
import type { EdgeId, EdgeInput } from '../types'
import { panViewport, zoomViewport } from '../geometry'
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
} from '../mindmap'

export type PlanPayload<T = unknown> = {
  operations: Operation[]
  value?: T
}

export type PlanResult<T = unknown> = CoreResult<PlanPayload<T>>

const success = <T,>(operations: Operation[], value?: T): PlanResult<T> => ({
  ok: true,
  operations,
  value
})

const invalid = <T = unknown,>(message: string): PlanResult<T> => ({
  ok: false,
  message
})

const fromOperation = (
  result: CoreResult<{ operation: Operation }>
): PlanResult => result.ok
  ? success([result.operation])
  : invalid(result.message)

const fromOperations = (
  result: CoreResult<{ operations: Operation[] }>
): PlanResult => result.ok
  ? success(result.operations)
  : invalid(result.message)

type MindmapSuccess<T> = Extract<MindmapCommandResult<T>, { ok: true }>

const readMindmap = (doc: Document, id: MindmapId): MindmapTree | undefined =>
  doc.mindmaps?.find((tree) => tree.id === id)

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

const runMindmapPlan = <T, V = unknown>({
  doc,
  id,
  options,
  run,
  value
}: {
  doc: Document
  id: MindmapId
  options?: MindmapCommandOptions
  run: (tree: MindmapTree) => MindmapCommandResult<T>
  value?: (result: MindmapSuccess<T>) => V
}): PlanResult<V> => {
  const beforeTree = readMindmap(doc, id)
  if (!beforeTree) return invalid(`Mindmap ${id} not found.`)

  const next = run(beforeTree)
  if (!next.ok) return invalid(next.message)

  return success(
    createReplaceOps({
      id,
      beforeTree,
      afterTree: next.tree,
      hint: options?.layout,
      node: doc.nodes.find((node) => node.id === id)
    }),
    value?.(next)
  )
}

export const corePlan = {
  node: {
    create: ({
      payload,
      doc,
      registries,
      createNodeId
    }: {
      payload: NodeInput
      doc: Document
      registries: CoreRegistries
      createNodeId: () => NodeId
    }): PlanResult =>
      fromOperation(
        buildNodeCreateOperation({
          payload,
          doc,
          registries,
          createNodeId
        })
      ),

    group: ({
      ids,
      doc,
      nodeSize,
      createGroupId
    }: {
      ids: NodeId[]
      doc: Document
      nodeSize: Size
      createGroupId: () => NodeId
    }): PlanResult =>
      fromOperations(
        buildNodeGroupOperations({
          ids,
          doc,
          nodeSize,
          createGroupId
        })
      ),

    ungroup: ({
      id,
      doc
    }: {
      id: NodeId
      doc: Document
    }): PlanResult =>
      fromOperations(buildNodeUngroupOperations(id, doc))
  },

  edge: {
    create: ({
      payload,
      doc,
      registries,
      createEdgeId
    }: {
      payload: EdgeInput
      doc: Document
      registries: CoreRegistries
      createEdgeId: () => EdgeId
    }): PlanResult =>
      fromOperation(
        buildEdgeCreateOperation({
          payload,
          doc,
          registries,
          createEdgeId
        })
      )
  },

  viewport: {
    set: ({
      before,
      viewport
    }: {
      before: Viewport
      viewport: Viewport
    }): PlanResult => {
      if (!viewport.center) {
        return invalid('Missing viewport center.')
      }
      if (!Number.isFinite(viewport.zoom) || viewport.zoom <= 0) {
        return invalid('Invalid viewport zoom.')
      }
      return success([{
        type: 'viewport.update',
        before,
        after: viewport
      }])
    },

    panBy: ({
      before,
      delta
    }: {
      before: Viewport
      delta: Point
    }): PlanResult => {
      if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
        return invalid('Invalid pan delta.')
      }
      return success([{
        type: 'viewport.update',
        before,
        after: panViewport(before, delta)
      }])
    },

    zoomBy: ({
      before,
      factor,
      anchor
    }: {
      before: Viewport
      factor: number
      anchor?: Point
    }): PlanResult => {
      if (!Number.isFinite(factor) || factor <= 0) {
        return invalid('Invalid zoom factor.')
      }
      return success([{
        type: 'viewport.update',
        before,
        after: zoomViewport(before, factor, anchor)
      }])
    },

    zoomTo: ({
      before,
      zoom,
      anchor
    }: {
      before: Viewport
      zoom: number
      anchor?: Point
    }): PlanResult => {
      const factor = before.zoom === 0 ? zoom : zoom / before.zoom
      if (!Number.isFinite(factor) || factor <= 0) {
        return invalid('Invalid zoom factor.')
      }
      return success([{
        type: 'viewport.update',
        before,
        after: zoomViewport(before, factor, anchor)
      }])
    },

    reset: ({
      before,
      viewport
    }: {
      before: Viewport
      viewport: Viewport
    }): PlanResult =>
      success([{
        type: 'viewport.update',
        before,
        after: viewport
      }])
  },

  mindmap: {
    create: ({
      payload,
      doc,
      createTreeId,
      createNodeId
    }: {
      payload?: MindmapCreateInput
      doc: Document
      createTreeId: () => MindmapId
      createNodeId: () => MindmapNodeId
    }): PlanResult<MindmapId> => {
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

      return success([createCreateOp(tree)], tree.id)
    },

    replace: ({
      id,
      tree,
      doc
    }: {
      id: MindmapId
      tree: MindmapTree
      doc: Document
    }): PlanResult => {
      const beforeTree = readMindmap(doc, id)
      if (!beforeTree) return invalid(`Mindmap ${id} not found.`)
      if (tree.id !== id) return invalid('Mindmap id mismatch.')
      return success([createReplaceOp({ id, beforeTree, afterTree: tree })])
    },

    delete: ({
      ids,
      doc
    }: {
      ids: MindmapId[]
      doc: Document
    }): PlanResult => {
      if (!ids.length) return invalid('No mindmap ids provided.')

      const trees: MindmapTree[] = []
      for (const id of ids) {
        const tree = readMindmap(doc, id)
        if (!tree) return invalid(`Mindmap ${id} not found.`)
        trees.push(tree)
      }

      return success(createDeleteOps(trees))
    },

    addChild: ({
      id,
      parentId,
      payload,
      options,
      doc,
      createNodeId
    }: {
      id: MindmapId
      parentId: MindmapNodeId
      payload?: MindmapNodeData | MindmapAttachPayload
      options?: MindmapCommandOptions
      doc: Document
      createNodeId: () => MindmapNodeId
    }): PlanResult<MindmapNodeId | undefined> =>
      runMindmapPlan({
        doc,
        id,
        options,
        run: (tree) =>
          addMindmapChild(
            tree,
            parentId,
            payload,
            withNodeIdGenerator(createNodeId, resolveSlot(options))
          ),
        value: (next) => next.value?.id
      }),

    addSibling: ({
      id,
      nodeId,
      position,
      payload,
      options,
      doc,
      createNodeId
    }: {
      id: MindmapId
      nodeId: MindmapNodeId
      position: 'before' | 'after'
      payload?: MindmapNodeData | MindmapAttachPayload
      options?: MindmapCommandOptions
      doc: Document
      createNodeId: () => MindmapNodeId
    }): PlanResult<MindmapNodeId | undefined> =>
      runMindmapPlan({
        doc,
        id,
        options,
        run: (tree) =>
          addMindmapSibling(
            tree,
            nodeId,
            position,
            payload,
            withNodeIdGenerator(createNodeId)
          ),
        value: (next) => next.value?.id
      }),

    moveSubtree: ({
      id,
      nodeId,
      newParentId,
      options,
      doc
    }: {
      id: MindmapId
      nodeId: MindmapNodeId
      newParentId: MindmapNodeId
      options?: MindmapCommandOptions
      doc: Document
    }): PlanResult =>
      runMindmapPlan({
        doc,
        id,
        options,
        run: (tree) =>
          moveMindmapSubtree(tree, nodeId, newParentId, resolveSlot(options))
      }),

    removeSubtree: ({
      id,
      nodeId,
      doc
    }: {
      id: MindmapId
      nodeId: MindmapNodeId
      doc: Document
    }): PlanResult =>
      runMindmapPlan({
        doc,
        id,
        run: (tree) => removeMindmapSubtree(tree, nodeId)
      }),

    cloneSubtree: ({
      id,
      nodeId,
      options,
      doc,
      createNodeId
    }: {
      id: MindmapId
      nodeId: MindmapNodeId
      options?: {
        parentId?: MindmapNodeId
        index?: number
        side?: 'left' | 'right'
      }
      doc: Document
      createNodeId: () => MindmapNodeId
    }): PlanResult<MindmapNodeId | undefined> =>
      runMindmapPlan({
        doc,
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
        value: (next) => next.value?.id
      }),

    toggleCollapse: ({
      id,
      nodeId,
      collapsed,
      doc
    }: {
      id: MindmapId
      nodeId: MindmapNodeId
      collapsed?: boolean
      doc: Document
    }): PlanResult =>
      runMindmapPlan({
        doc,
        id,
        run: (tree) => toggleMindmapCollapse(tree, nodeId, collapsed)
      }),

    setNodeData: ({
      id,
      nodeId,
      patch,
      doc
    }: {
      id: MindmapId
      nodeId: MindmapNodeId
      patch: Partial<MindmapNodeData>
      doc: Document
    }): PlanResult =>
      runMindmapPlan({
        doc,
        id,
        run: (tree) => setMindmapNodeData(tree, nodeId, patch)
      }),

    reorderChild: ({
      id,
      parentId,
      fromIndex,
      toIndex,
      doc
    }: {
      id: MindmapId
      parentId: MindmapNodeId
      fromIndex: number
      toIndex: number
      doc: Document
    }): PlanResult =>
      runMindmapPlan({
        doc,
        id,
        run: (tree) => reorderMindmapChild(tree, parentId, fromIndex, toIndex)
      }),

    setSide: ({
      id,
      nodeId,
      side,
      doc
    }: {
      id: MindmapId
      nodeId: MindmapNodeId
      side: 'left' | 'right'
      doc: Document
    }): PlanResult =>
      runMindmapPlan({
        doc,
        id,
        run: (tree) => setMindmapSide(tree, nodeId, side)
      }),

    attachExternal: ({
      id,
      targetId,
      payload,
      options,
      doc,
      createNodeId
    }: {
      id: MindmapId
      targetId: MindmapNodeId
      payload: MindmapAttachPayload
      options?: MindmapCommandOptions
      doc: Document
      createNodeId: () => MindmapNodeId
    }): PlanResult<MindmapNodeId | undefined> =>
      runMindmapPlan({
        doc,
        id,
        options,
        run: (tree) =>
          attachMindmapExternal(
            tree,
            targetId,
            payload,
            withNodeIdGenerator(createNodeId, resolveSlot(options))
          ),
        value: (next) => next.value?.id
      })
  }
}
