import type {
  Document,
  Node,
  NodeId
} from '@whiteboard/core/types'
import { NodeOverrideState } from './NodeOverrideState'
import type { ProjectionSnapshot, NodeViewUpdate } from '@engine-types/projection'
import {
  orderByIds,
  patchNodeListByIds
} from './shared'
import {
  deriveCanvasNodes,
  deriveVisibleNodes
} from '../../actors/node/domain'
import { SnapshotState } from './SnapshotState'
import { ViewNodesState } from './ViewNodesState'
import { VisibleEdgesState } from './VisibleEdgesState'

export class ProjectionCache {
  private readonly nodeOverrides = new NodeOverrideState()
  private readonly viewNodesState = new ViewNodesState()
  private readonly visibleEdgesState = new VisibleEdgesState()
  private readonly snapshotState = new SnapshotState()

  read = (doc: Document | null): ProjectionSnapshot => {
    if (!doc) {
      this.viewNodesState.reset()
      this.visibleEdgesState.reset()
      return this.snapshotState.reset()
    }

    const overrides = this.nodeOverrides.readMap()
    const viewNodesUpdate = this.viewNodesState.update(
      doc,
      overrides
    )
    const nextViewNodesCache = viewNodesUpdate.cache

    const readViewNodeById = (nodeId: NodeId): Node | undefined => {
      const index = nextViewNodesCache.indexById.get(nodeId)
      if (index === undefined) return undefined
      return nextViewNodesCache.nodes[index]
    }

    const snapshot = this.snapshotState.read()
    let nextVisibleNodes: Node[]
    let nextCanvasNodes: Node[]

    if (!viewNodesUpdate.sourceNodesChanged && viewNodesUpdate.changedNodeIds.size) {
      nextVisibleNodes = patchNodeListByIds(
        snapshot.visibleNodes,
        viewNodesUpdate.changedNodeIds,
        this.snapshotState.readVisibleNodeIndex(),
        readViewNodeById
      )
      nextCanvasNodes = patchNodeListByIds(
        snapshot.canvasNodes,
        viewNodesUpdate.changedNodeIds,
        this.snapshotState.readCanvasNodeIndex(),
        readViewNodeById
      )
    } else {
      const nodeOrder = doc.order?.nodes ?? doc.nodes.map((node) => node.id)
      const orderedViewNodes = orderByIds(nextViewNodesCache.nodes, nodeOrder)
      nextVisibleNodes = deriveVisibleNodes(orderedViewNodes)
      nextCanvasNodes = deriveCanvasNodes(nextVisibleNodes)
    }

    const resolvedVisibleEdges = this.visibleEdgesState.resolve(
      doc,
      nextCanvasNodes
    )
    const nextSnapshot = this.snapshotState.apply({
      visibleNodes: nextVisibleNodes,
      canvasNodes: nextCanvasNodes,
      visibleEdges: resolvedVisibleEdges
    })
    this.visibleEdgesState.syncVisibleEdgesRef(nextSnapshot.visibleEdges)

    return nextSnapshot
  }

  readNode = (doc: Document | null, nodeId: NodeId): Node | undefined =>
    this.read(doc).canvasNodeById.get(nodeId)

  readNodeOverrides = (): NodeViewUpdate[] => this.nodeOverrides.readUpdates()

  patchNodeOverrides = (updates: NodeViewUpdate[]): NodeId[] =>
    this.nodeOverrides.patch(updates)

  clearNodeOverrides = (ids?: NodeId[]): NodeId[] =>
    this.nodeOverrides.clear(ids)
}
