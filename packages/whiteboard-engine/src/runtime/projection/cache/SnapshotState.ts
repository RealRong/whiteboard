import type { Edge, Node, NodeId } from '@whiteboard/core/types'
import type { ProjectionSnapshot } from '@engine-types/projection'
import {
  EMPTY_EDGES,
  EMPTY_NODE_MAP,
  EMPTY_NODES,
  buildIndexById,
  isSameRefList
} from './shared'

type SnapshotInput = {
  visibleNodes: Node[]
  canvasNodes: Node[]
  visibleEdges: Edge[]
}

export class SnapshotState {
  private snapshot: ProjectionSnapshot = {
    visibleNodes: EMPTY_NODES,
    canvasNodes: EMPTY_NODES,
    canvasNodeById: EMPTY_NODE_MAP,
    visibleEdges: EMPTY_EDGES
  }

  private visibleNodeIndexById = new Map<NodeId, number>()
  private canvasNodeIndexById = new Map<NodeId, number>()

  read = () => this.snapshot

  readVisibleNodeIndex = () => this.visibleNodeIndexById

  readCanvasNodeIndex = () => this.canvasNodeIndexById

  reset = () => {
    this.visibleNodeIndexById = new Map<NodeId, number>()
    this.canvasNodeIndexById = new Map<NodeId, number>()
    if (
      this.snapshot.visibleNodes === EMPTY_NODES &&
      this.snapshot.canvasNodes === EMPTY_NODES &&
      this.snapshot.canvasNodeById === EMPTY_NODE_MAP &&
      this.snapshot.visibleEdges === EMPTY_EDGES
    ) {
      return this.snapshot
    }
    this.snapshot = {
      visibleNodes: EMPTY_NODES,
      canvasNodes: EMPTY_NODES,
      canvasNodeById: EMPTY_NODE_MAP,
      visibleEdges: EMPTY_EDGES
    }
    return this.snapshot
  }

  apply = ({
    visibleNodes: nextVisibleNodes,
    canvasNodes: nextCanvasNodes,
    visibleEdges: nextVisibleEdges
  }: SnapshotInput): ProjectionSnapshot => {
    const previous = this.snapshot
    const visibleNodes = isSameRefList(previous.visibleNodes, nextVisibleNodes)
      ? previous.visibleNodes
      : nextVisibleNodes
    const canvasNodes = isSameRefList(previous.canvasNodes, nextCanvasNodes)
      ? previous.canvasNodes
      : nextCanvasNodes
    const canvasNodeById =
      canvasNodes === previous.canvasNodes
        ? previous.canvasNodeById
        : new Map(canvasNodes.map((node) => [node.id, node]))
    const visibleEdges = isSameRefList(previous.visibleEdges, nextVisibleEdges)
      ? previous.visibleEdges
      : nextVisibleEdges

    if (visibleNodes !== previous.visibleNodes) {
      this.visibleNodeIndexById = buildIndexById(visibleNodes)
    }
    if (canvasNodes !== previous.canvasNodes) {
      this.canvasNodeIndexById = buildIndexById(canvasNodes)
    }

    if (
      visibleNodes !== previous.visibleNodes ||
      canvasNodes !== previous.canvasNodes ||
      canvasNodeById !== previous.canvasNodeById ||
      visibleEdges !== previous.visibleEdges
    ) {
      this.snapshot = {
        visibleNodes,
        canvasNodes,
        canvasNodeById,
        visibleEdges
      }
    }

    return this.snapshot
  }
}
