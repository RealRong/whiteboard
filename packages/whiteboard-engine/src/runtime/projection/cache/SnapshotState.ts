import type { Document } from '@whiteboard/core/types'
import type {
  ProjectionEdgesSlice,
  ProjectionIndexesSlice,
  ProjectionMindmapSlice,
  ProjectionNodesSlice,
  ProjectionSnapshot
} from '@engine-types/projection'
import {
  EMPTY_EDGES,
  EMPTY_INDEX_BY_ID,
  EMPTY_NODE_IDS,
  EMPTY_NODE_MAP,
  EMPTY_NODES
} from './shared'

type SnapshotInput = {
  docId: Document['id'] | undefined
  nodes: ProjectionNodesSlice
  edges: ProjectionEdgesSlice
  mindmap: ProjectionMindmapSlice
  indexes: ProjectionIndexesSlice
}

export class SnapshotState {
  private snapshot: ProjectionSnapshot = {
    revision: 0,
    docId: undefined,
    nodes: {
      visible: EMPTY_NODES,
      canvas: EMPTY_NODES
    },
    edges: {
      visible: EMPTY_EDGES
    },
    mindmap: {
      roots: EMPTY_NODE_IDS
    },
    indexes: {
      canvasNodeById: EMPTY_NODE_MAP,
      visibleNodeIndexById: EMPTY_INDEX_BY_ID,
      canvasNodeIndexById: EMPTY_INDEX_BY_ID
    }
  }

  read = () => this.snapshot

  reset = () => {
    const previous = this.snapshot
    const isEmpty =
      previous.docId === undefined &&
      previous.nodes.visible === EMPTY_NODES &&
      previous.nodes.canvas === EMPTY_NODES &&
      previous.edges.visible === EMPTY_EDGES &&
      previous.mindmap.roots === EMPTY_NODE_IDS &&
      previous.indexes.canvasNodeById === EMPTY_NODE_MAP &&
      previous.indexes.visibleNodeIndexById === EMPTY_INDEX_BY_ID &&
      previous.indexes.canvasNodeIndexById === EMPTY_INDEX_BY_ID
    if (isEmpty) return previous

    this.snapshot = {
      revision: previous.revision + 1,
      docId: undefined,
      nodes: {
        visible: EMPTY_NODES,
        canvas: EMPTY_NODES
      },
      edges: {
        visible: EMPTY_EDGES
      },
      mindmap: {
        roots: EMPTY_NODE_IDS
      },
      indexes: {
        canvasNodeById: EMPTY_NODE_MAP,
        visibleNodeIndexById: EMPTY_INDEX_BY_ID,
        canvasNodeIndexById: EMPTY_INDEX_BY_ID
      }
    }
    return this.snapshot
  }

  apply = ({ docId, nodes, edges, mindmap, indexes }: SnapshotInput): ProjectionSnapshot => {
    const previous = this.snapshot
    const changed =
      docId !== previous.docId ||
      nodes.visible !== previous.nodes.visible ||
      nodes.canvas !== previous.nodes.canvas ||
      edges.visible !== previous.edges.visible ||
      mindmap.roots !== previous.mindmap.roots ||
      indexes.canvasNodeById !== previous.indexes.canvasNodeById ||
      indexes.visibleNodeIndexById !== previous.indexes.visibleNodeIndexById ||
      indexes.canvasNodeIndexById !== previous.indexes.canvasNodeIndexById

    if (!changed) return previous

    this.snapshot = {
      revision: previous.revision + 1,
      docId,
      nodes,
      edges,
      mindmap,
      indexes
    }
    return this.snapshot
  }
}
