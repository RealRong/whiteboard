import type { InputSessionContext } from '@engine-types/input'
import type { Query } from '@engine-types/instance/query'
import type { CleanupActors } from '../lifecycle/Cleanup'
import type { Actor as EdgeActor } from '../actors/edge/Actor'
import type { Actor as MindmapActor } from '../actors/mindmap/Actor'
import type { Actor as NodeActor } from '../actors/node/Actor'

type ActorPortOptions = {
  edge: EdgeActor
  node: NodeActor
  mindmap: MindmapActor
  query: Query
}

type LifecycleActors = {
  mindmap?: MindmapActor
}

export class ActorPort {
  private readonly edge: EdgeActor
  private readonly node: NodeActor
  private readonly mindmap: MindmapActor
  private readonly query: Query

  constructor({ edge, node, mindmap, query }: ActorPortOptions) {
    this.edge = edge
    this.node = node
    this.mindmap = mindmap
    this.query = query
  }

  inputActors: InputSessionContext['actors'] = {
    edge: {
      startFromHandle: (nodeId, side, pointer) =>
        this.edge.startFromHandle(nodeId, side, pointer),
      startReconnect: (edgeId, end, pointer) =>
        this.edge.startReconnect(edgeId, end, pointer),
      handleNodePointerDown: (nodeId, pointer) =>
        this.edge.handleNodePointerDown(nodeId, pointer),
      startRouting: (edgeId, index, pointer) =>
        this.edge.startRouting({ edgeId, index, pointer }),
      hoverMove: (pointer, enabled) => this.edge.hoverMove(pointer, enabled),
      updateConnect: (pointer) => this.edge.updateConnect(pointer),
      commitConnect: (pointer) => this.edge.commitConnect(pointer),
      cancelConnect: () => this.edge.cancelConnect(),
      updateRouting: (pointer) => this.edge.updateRouting(pointer),
      endRouting: (pointer) => this.edge.endRouting(pointer),
      cancelRouting: () => this.edge.cancelRouting()
    },
    node: {
      startDrag: (nodeId, pointer) =>
        this.node.startDrag({ nodeId, pointer }),
      startResize: (nodeId, pointer, handle) => {
        const entry = this.query.canvas.nodeRect(nodeId)
        if (!entry) return false
        return this.node.startResize({
          nodeId,
          pointer,
          handle,
          rect: entry.rect,
          rotation: entry.rotation
        })
      },
      startRotate: (nodeId, pointer) => {
        const entry = this.query.canvas.nodeRect(nodeId)
        if (!entry) return false
        return this.node.startRotate({
          nodeId,
          pointer,
          rect: entry.rect,
          rotation: entry.rotation
        })
      },
      updateDrag: (pointer) => this.node.updateDrag(pointer),
      endDrag: (pointer) => this.node.endDrag(pointer),
      cancelDrag: () => this.node.cancelDrag(),
      updateTransform: (pointer, minSize) =>
        this.node.updateTransform(pointer, minSize),
      endTransform: (pointer) => this.node.endTransform(pointer),
      cancelTransform: () => this.node.cancelTransform()
    },
    mindmap: {
      startDrag: (treeId, nodeId, pointer) =>
        this.mindmap.startDrag({ treeId, nodeId, pointer }),
      updateDrag: (pointer) => this.mindmap.updateDrag(pointer),
      endDrag: (pointer) => this.mindmap.endDrag(pointer),
      cancelDrag: () => this.mindmap.cancelDrag()
    }
  }

  get cleanupActors(): CleanupActors {
    return {
      edge: this.edge,
      node: this.node,
      mindmap: this.mindmap
    }
  }

  get lifecycleActors(): LifecycleActors {
    return {
      mindmap: this.mindmap
    }
  }
}
