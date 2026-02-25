import type {
  Document
} from '@whiteboard/core/types'
import type { ProjectionSnapshot } from '@engine-types/projection'
import { SnapshotState } from './SnapshotState'
import { NodeProjector } from '../projectors/NodeProjector'
import { EdgeProjector } from '../projectors/EdgeProjector'
import { MindmapProjector } from '../projectors/MindmapProjector'
import { IndexProjector } from '../projectors/IndexProjector'

export class ProjectionCache {
  private readonly nodeProjector = new NodeProjector()
  private readonly edgeProjector = new EdgeProjector()
  private readonly mindmapProjector = new MindmapProjector()
  private readonly indexProjector = new IndexProjector()
  private readonly snapshotState = new SnapshotState()

  read = (doc: Document | null): ProjectionSnapshot => {
    if (!doc) {
      this.nodeProjector.reset()
      this.edgeProjector.reset()
      return this.snapshotState.reset()
    }

    const snapshot = this.snapshotState.read()
    const nodes = this.nodeProjector.project({
      doc
    })
    const edges = this.edgeProjector.project({
      doc,
      canvasNodes: nodes.canvas
    })
    const mindmap = this.mindmapProjector.project({
      visibleNodes: nodes.visible,
      previous: snapshot.mindmap
    })
    const indexes = this.indexProjector.project({
      nodes,
      previous: snapshot
    })

    const nextSnapshot = this.snapshotState.apply({
      docId: doc.id,
      nodes,
      edges,
      mindmap,
      indexes
    })

    return nextSnapshot
  }
}
