import type { CoreRegistries, DispatchResult, Document, Node } from '@whiteboard/core'
import type { CommandSource } from '@engine-types/command'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { GraphChange, GraphProjector } from '@engine-types/graph'
import type { InputSessionContext } from '@engine-types/input'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Query } from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type { Scheduler } from '../runtime/common/contracts'
import { Actor as EdgeActor } from '../runtime/actors/edge/Actor'
import { Actor as GraphActor } from '../runtime/actors/graph/Actor'
import { Actor as MindmapActor } from '../runtime/actors/mindmap/Actor'
import { Actor as NodeActor } from '../runtime/actors/node/Actor'
import { MutationExecutor } from '../runtime/actors/shared/MutationExecutor'
import { ViewActor } from '../runtime/actors/view/Actor'
import { Domain as ViewportDomainActor } from '../runtime/actors/viewport/Domain'

type Options = {
  instance: InternalInstance
  state: State
  graph: GraphProjector
  query: Query
  emit: InstanceEventEmitter['emit']
  registries: CoreRegistries
  readDoc: () => Document
  readNodes: () => Node[]
  config: InstanceConfig
  syncQueryGraph?: (change: GraphChange) => void
  scheduler: Scheduler
  write: {
    mutate: (
      input: Parameters<InternalInstance['mutate']>[0]
    ) => ReturnType<InternalInstance['mutate']>
    dispatchIntent: (
      intent: Parameters<MutationExecutor['runCommand']>[0],
      options: { source?: CommandSource; actor?: string }
    ) => Promise<DispatchResult>
  }
}

export const createActorRuntime = ({
  instance,
  state,
  graph,
  query,
  emit,
  registries,
  readDoc,
  readNodes,
  config,
  syncQueryGraph,
  scheduler,
  write
}: Options) => {
  const view = new ViewActor({
    state,
    graph,
    query,
    config,
    syncQueryGraph
  })
  const mutation = new MutationExecutor({
    mutate: write.mutate,
    dispatchIntent: write.dispatchIntent
  })
  const edge = new EdgeActor({
    instance,
    registries,
    scheduler,
    mutation
  })
  const node = new NodeActor({
    state,
    graph,
    syncGraph: view.sync,
    readDoc,
    instance,
    mutation
  })
  const mindmap = new MindmapActor({
    state,
    emit,
    instance,
    mutation
  })
  const graphActor = new GraphActor({
    graph,
    readNodes
  })
  const viewport = new ViewportDomainActor({
    instance,
    dispatchIntent: write.dispatchIntent
  })
  const inputActors: InputSessionContext['actors'] = {
    edge: {
      startFromHandle: (nodeId, side, pointer) =>
        edge.startFromHandle(nodeId, side, pointer),
      startReconnect: (edgeId, end, pointer) =>
        edge.startReconnect(edgeId, end, pointer),
      handleNodePointerDown: (nodeId, pointer) =>
        edge.handleNodePointerDown(nodeId, pointer),
      startRouting: (edgeId, index, pointer) =>
        edge.startRouting({ edgeId, index, pointer }),
      insertRoutingPointAt: (edgeId, pointWorld) =>
        edge.insertRoutingPointAt(edgeId, pointWorld),
      removeRoutingPointAt: (edgeId, index) =>
        edge.removeRoutingPointAt(edgeId, index),
      hoverMove: (pointer, enabled) => edge.hoverMove(pointer, enabled),
      updateConnect: (pointer) => edge.updateConnect(pointer),
      commitConnect: (pointer) => edge.commitConnect(pointer),
      cancelConnect: () => edge.cancelConnect(),
      updateRouting: (pointer) => edge.updateRouting(pointer),
      endRouting: (pointer) => edge.endRouting(pointer),
      cancelRouting: () => edge.cancelRouting()
    },
    node: {
      startDrag: (nodeId, pointer) =>
        node.startDrag({ nodeId, pointer }),
      startResize: (nodeId, pointer, handle) => {
        const entry = query.canvas.nodeRect(nodeId)
        if (!entry) return false
        return node.startResize({
          nodeId,
          pointer,
          handle,
          rect: entry.rect,
          rotation: entry.rotation
        })
      },
      startRotate: (nodeId, pointer) => {
        const entry = query.canvas.nodeRect(nodeId)
        if (!entry) return false
        return node.startRotate({
          nodeId,
          pointer,
          rect: entry.rect,
          rotation: entry.rotation
        })
      },
      updateDrag: (pointer) => node.updateDrag(pointer),
      endDrag: (pointer) => node.endDrag(pointer),
      cancelDrag: () => node.cancelDrag(),
      updateTransform: (pointer, minSize) =>
        node.updateTransform(pointer, minSize),
      endTransform: (pointer) => node.endTransform(pointer),
      cancelTransform: () => node.cancelTransform()
    },
    mindmap: {
      startDrag: (treeId, nodeId, pointer) =>
        mindmap.startDrag({ treeId, nodeId, pointer }),
      updateDrag: (pointer) => mindmap.updateDrag(pointer),
      endDrag: (pointer) => mindmap.endDrag(pointer),
      cancelDrag: () => mindmap.cancelDrag()
    }
  }

  return {
    edge,
    node,
    mindmap,
    graph: graphActor,
    viewport,
    view,
    inputActors
  }
}
