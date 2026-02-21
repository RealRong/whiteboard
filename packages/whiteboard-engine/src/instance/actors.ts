import type { Document, Node } from '@whiteboard/core'
import type { GraphChange, GraphProjector } from '@engine-types/graph'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Query } from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type { SchedulerRuntime } from '../runtime/common/contracts'
import { ActorPort } from '../runtime/actors/port/ActorPort'
import { Actor as EdgeActor } from '../runtime/actors/edge/Actor'
import { Actor as GraphActor } from '../runtime/actors/graph/Actor'
import { Actor as MindmapActor } from '../runtime/actors/mindmap/Actor'
import { Actor as NodeActor } from '../runtime/actors/node/Actor'
import { Actor as ViewActor } from '../runtime/actors/view/Actor'
import { Domain as ViewportDomainActor } from '../runtime/actors/viewport/Domain'

type Options = {
  instance: InternalInstance
  state: State
  graph: GraphProjector
  query: Query
  emit: InstanceEventEmitter['emit']
  readDoc: () => Document | null
  readNodes: () => Node[]
  syncGraph: (change: GraphChange) => void
  schedulers: SchedulerRuntime
}

export const createActorRuntime = ({
  instance,
  state,
  graph,
  query,
  emit,
  readDoc,
  readNodes,
  syncGraph,
  schedulers
}: Options) => {
  const edge = new EdgeActor({
    instance,
    schedulers
  })
  const node = new NodeActor({
    state,
    graph,
    syncGraph,
    readDoc,
    instance
  })
  const mindmap = new MindmapActor({
    state,
    emit,
    instance
  })
  const graphActor = new GraphActor({
    graph,
    readNodes
  })
  const view = new ViewActor({
    syncGraph
  })
  const viewport = new ViewportDomainActor({
    instance
  })
  const port = new ActorPort({
    edge,
    node,
    mindmap,
    query
  })

  return {
    edge,
    node,
    mindmap,
    graph: graphActor,
    viewport,
    view,
    port
  }
}
