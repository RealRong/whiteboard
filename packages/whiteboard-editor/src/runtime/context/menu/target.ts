import type {
  EdgeId,
  Node,
  NodeId,
  Point
} from '@whiteboard/core/types'
import type { EditorPick as PointerPick } from '../../pick'

export type ContextTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; nodeId: NodeId; world: Point }
  | { kind: 'nodes'; nodeIds: readonly NodeId[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

export type ContextResolved =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; node: Node; world: Point }
  | { kind: 'nodes'; nodes: readonly Node[]; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

type ContextTargetInput = {
  pick: PointerPick
  world: Point
  selectionNodeIds: readonly NodeId[]
  selectionNodeSet: ReadonlySet<NodeId>
  selectionCount: number
}

type ContextResolveDeps = {
  getNode: (nodeId: NodeId) => Node | undefined
  hasEdge: (edgeId: EdgeId) => boolean
}

const readSelectedNodesTarget = (
  nodeId: NodeId,
  input: Pick<
    ContextTargetInput,
    'selectionNodeSet' | 'selectionNodeIds' | 'selectionCount' | 'world'
  >
): ContextTarget => (
  input.selectionNodeSet.has(nodeId) && input.selectionCount > 1
    ? {
        kind: 'nodes',
        nodeIds: input.selectionNodeIds,
        world: input.world
      }
    : {
        kind: 'node',
        nodeId,
        world: input.world
      }
)

export const readContextTarget = ({
  pick,
  world,
  selectionNodeIds,
  selectionNodeSet,
  selectionCount
}: ContextTargetInput): ContextTarget => {
  switch (pick.kind) {
    case 'selection-box':
      return selectionCount > 1
        ? {
            kind: 'nodes',
            nodeIds: selectionNodeIds,
            world
          }
        : {
            kind: 'canvas',
            world
          }
    case 'node':
      return readSelectedNodesTarget(pick.id, {
        selectionNodeSet,
        selectionNodeIds,
        selectionCount,
        world
      })
    case 'edge':
      return {
        kind: 'edge',
        edgeId: pick.id,
        world
      }
    case 'background':
    case 'mindmap':
      return {
        kind: 'canvas',
        world
      }
  }
}

const resolveNodeList = (
  deps: ContextResolveDeps,
  nodeIds: readonly NodeId[]
): readonly Node[] => nodeIds
  .map((nodeId) => deps.getNode(nodeId))
  .filter((node): node is Node => Boolean(node))

export const resolveContextTarget = (
  deps: ContextResolveDeps,
  target: ContextTarget
): ContextResolved | undefined => {
  switch (target.kind) {
    case 'canvas':
      return target
    case 'node': {
      const node = deps.getNode(target.nodeId)
      if (!node) {
        return undefined
      }

      return {
        kind: 'node',
        node,
        world: target.world
      }
    }
    case 'nodes': {
      const nodes = resolveNodeList(deps, target.nodeIds)
      if (!nodes.length) {
        return undefined
      }

      return {
        kind: 'nodes',
        nodes,
        world: target.world
      }
    }
    case 'edge':
      return deps.hasEdge(target.edgeId)
        ? target
        : undefined
  }
}
