import type {
  ProjectionIndexesSlice,
  ProjectionNodesSlice,
  ProjectionSnapshot
} from '@engine-types/projection'
import {
  EMPTY_INDEX_BY_ID,
  EMPTY_NODE_MAP,
  buildIndexById
} from '../cache/shared'

type IndexProjectInput = {
  nodes: ProjectionNodesSlice
  previous: ProjectionSnapshot
}

export class IndexProjector {
  project = ({
    nodes,
    previous
  }: IndexProjectInput): ProjectionIndexesSlice => {
    const canvasNodeById =
      nodes.canvas === previous.nodes.canvas
        ? previous.indexes.canvasNodeById
        : nodes.canvas.length
          ? new Map(nodes.canvas.map((node) => [node.id, node]))
          : EMPTY_NODE_MAP

    const visibleNodeIndexById =
      nodes.visible === previous.nodes.visible
        ? previous.indexes.visibleNodeIndexById
        : nodes.visible.length
          ? buildIndexById(nodes.visible)
          : EMPTY_INDEX_BY_ID

    const canvasNodeIndexById =
      nodes.canvas === previous.nodes.canvas
        ? previous.indexes.canvasNodeIndexById
        : nodes.canvas.length
          ? buildIndexById(nodes.canvas)
          : EMPTY_INDEX_BY_ID

    return {
      canvasNodeById,
      visibleNodeIndexById,
      canvasNodeIndexById
    }
  }
}
