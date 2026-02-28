import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  MindmapLayoutHint,
  MindmapNodeId,
  MindmapTree,
  Node,
  Operation
} from '@whiteboard/core/types'
import { layoutMindmap, layoutMindmapTidy } from '@whiteboard/core/mindmap'
import { DEFAULT_TUNING } from '../../../../config'
import { createScopedId } from '../../id'

type MindmapInstance = Pick<InternalInstance, 'document' | 'mutate'>

export type MindmapHelpers = {
  createInvalidResult: (message: string) => DispatchResult
  readMindmap: (id: string) => MindmapTree | undefined
  createMindmapId: () => string
  createMindmapNodeId: () => string
  cloneTree: (tree: MindmapTree) => MindmapTree
  runMutationsWithValue: (operations: Operation[], value?: unknown) => Promise<DispatchResult>
  toLayoutHint: (
    anchorId: MindmapNodeId,
    nodeSize: { width: number; height: number },
    layout: MindmapLayoutConfig
  ) => MindmapLayoutHint
  resolveRootInsertSide: (
    placement: 'left' | 'right' | 'up' | 'down',
    layout: MindmapLayoutConfig
  ) => 'left' | 'right'
  createReplaceOperations: (
    id: string,
    before: MindmapTree,
    after: MindmapTree,
    layout?: MindmapLayoutHint
  ) => Operation[]
}

type CreateMindmapHelpersOptions = {
  instance: MindmapInstance
}

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (typeof clone === 'function') {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export const createMindmapHelpers = ({ instance }: CreateMindmapHelpersOptions): MindmapHelpers => {
  const createInvalidResult = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })

  const readMindmap = (id: string): MindmapTree | undefined =>
    (instance.document.get().mindmaps ?? []).find((tree) => tree.id === id)

  const readMindmapNode = (id: string): Node | undefined =>
    instance.document.get().nodes.find((node) => node.id === id)

  const hasMindmapId = (id: string) => Boolean(readMindmap(id))
  const hasMindmapNodeId = (id: string) =>
    (instance.document.get().mindmaps ?? []).some((tree) => Boolean(tree.nodes[id as MindmapNodeId]))

  const createMindmapId = () => createScopedId({ prefix: 'mindmap', exists: hasMindmapId })
  const createMindmapNodeId = () => createScopedId({ prefix: 'mnode', exists: hasMindmapNodeId })

  const cloneTree = (tree: MindmapTree): MindmapTree => cloneValue(tree)

  const cloneNode = (node: Node): Node => cloneValue(node)

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

  const getLayoutHint = (hint?: MindmapLayoutHint) => {
    if (!hint?.nodeSize) return undefined
    if (!hint.anchorId) return undefined
    return hint
  }

  const computeAnchorWorld = (
    tree: MindmapTree,
    hint: MindmapLayoutHint,
    nodePosition: { x: number; y: number }
  ) => {
    const layoutFn = hint.mode === 'tidy' ? layoutMindmapTidy : layoutMindmap
    const layout = layoutFn(tree, () => hint.nodeSize as { width: number; height: number }, hint.options)
    const anchorId = hint.anchorId ?? tree.rootId
    const rect = layout.node[anchorId]
    if (!rect) return undefined
    const shiftX = -layout.bbox.x
    const shiftY = -layout.bbox.y
    return {
      x: nodePosition.x + rect.x + shiftX + rect.width / 2,
      y: nodePosition.y + rect.y + shiftY + rect.height / 2
    }
  }

  const computeAnchorPatch = (
    beforeTree: MindmapTree,
    afterTree: MindmapTree,
    hint: MindmapLayoutHint,
    mindmapNode: Node
  ) => {
    const before = computeAnchorWorld(beforeTree, hint, mindmapNode.position)
    const after = computeAnchorWorld(afterTree, hint, mindmapNode.position)
    if (!before || !after) return undefined
    const dx = before.x - after.x
    const dy = before.y - after.y
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return undefined
    return {
      position: {
        x: mindmapNode.position.x + dx,
        y: mindmapNode.position.y + dy
      }
    }
  }

  const appendAnchorPatch = (
    operations: Operation[],
    mindmapId: string,
    beforeTree: MindmapTree,
    afterTree: MindmapTree,
    layout?: MindmapLayoutHint
  ): Operation[] => {
    const layoutHint = getLayoutHint(layout)
    if (!layoutHint) return operations
    const mindmapNode = readMindmapNode(mindmapId)
    if (!mindmapNode) return operations
    const anchorPatch = computeAnchorPatch(beforeTree, afterTree, layoutHint, mindmapNode)
    if (!anchorPatch) return operations
    return [
      ...operations,
      {
        type: 'node.update',
        id: mindmapNode.id,
        patch: anchorPatch,
        before: cloneNode(mindmapNode)
      }
    ]
  }

  const createReplaceOperations = (
    id: string,
    before: MindmapTree,
    after: MindmapTree,
    layout?: MindmapLayoutHint
  ): Operation[] => {
    const operations: Operation[] = [
      {
        type: 'mindmap.replace',
        id,
        before: cloneTree(before),
        after: cloneTree(after)
      }
    ]
    return appendAnchorPatch(operations, id, before, after, layout)
  }

  const resolveRootInsertSide = (
    placement: 'left' | 'right' | 'up' | 'down',
    layout: MindmapLayoutConfig
  ): 'left' | 'right' => {
    if (placement === 'left') return 'left'
    if (placement === 'right') return 'right'
    const layoutSide = layout.options?.side
    return layoutSide === 'left' || layoutSide === 'right'
      ? layoutSide
      : DEFAULT_TUNING.mindmap.defaultSide
  }

  return {
    createInvalidResult,
    readMindmap,
    createMindmapId,
    createMindmapNodeId,
    cloneTree,
    runMutationsWithValue,
    toLayoutHint,
    resolveRootInsertSide,
    createReplaceOperations
  }
}
