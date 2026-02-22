import type { InstanceConfig } from '@engine-types/instance/config'
import type { GraphChange, GraphProjector } from '@engine-types/graph'
import type { Query } from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'
import { createViewRegistry } from './Registry'

type ActorOptions = {
  state: State
  graph: GraphProjector
  query: Query
  config: InstanceConfig
  syncQueryGraph?: (change: GraphChange) => void
}

export class ViewActor {
  readonly name = 'View'
  readonly view: View

  private readonly syncGraphRuntime: (change: GraphChange) => void

  constructor({
    state,
    graph,
    query,
    config,
    syncQueryGraph
  }: ActorOptions) {
    const runtime = createViewRegistry({
      state,
      graph,
      query,
      config,
      syncQueryGraph
    })
    this.view = runtime.view
    this.syncGraphRuntime = runtime.syncGraph
  }

  sync = (change: GraphChange | undefined) => {
    if (!change) return
    this.syncGraphRuntime(change)
  }
}
