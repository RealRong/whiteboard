import type { Core, Document, Node } from '@whiteboard/core'
import type { GraphChange, GraphProjector } from '@engine-types/graph'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Query } from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type { SchedulerRuntime } from '../runtime/common/contracts'
import { ActorPort } from '../runtime/coordinator/ActorPort'
import { Actor as EdgeActor } from '../runtime/actors/edge/Actor'
import { Actor as GraphActor } from '../runtime/actors/graph/Actor'
import { Actor as MindmapActor } from '../runtime/actors/mindmap/Actor'
import { Actor as NodeActor } from '../runtime/actors/node/Actor'
import { Actor as ViewActor } from '../runtime/actors/view/Actor'

type Options = {
  instance: InternalInstance
  state: State
  graph: GraphProjector
  query: Query
  emit: InstanceEventEmitter['emit']
  core: Core
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
  core,
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
    core,
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
    view,
    port
  }
}
