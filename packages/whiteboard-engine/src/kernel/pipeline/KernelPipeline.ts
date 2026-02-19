import type { GraphChange } from '@engine-types/graph'
import type { State, StateKey } from '@engine-types/instance/state'
import type { EdgeRegistry } from '../view/edgeRegistry'
import type { MindmapRegistry } from '../view/mindmapRegistry'
import type { NodeRegistry, NodeStateSyncKey } from '../view/nodeRegistry'
import type { ViewDependencyKey } from '../view/register'

type Options = {
  state: State
  derived: {
    invalidateDependencies: (keys: readonly ViewDependencyKey[]) => void
  }
  node: Pick<
    NodeRegistry,
    | 'syncCanvasNodes'
    | 'syncState'
  >
  edge: Pick<EdgeRegistry, 'sync'> & {
    syncGraph: (change: GraphChange) => void
  }
  query?: {
    syncGraph: (change: GraphChange) => void
  }
  mindmap: Pick<MindmapRegistry, 'sync'>
}

type DerivedSyncKey =
  | 'edge.paths'
  | 'mindmap.trees'

export class KernelPipeline {
  private readonly state: Options['state']
  private readonly derived: Options['derived']
  private readonly node: Options['node']
  private readonly edge: Options['edge']
  private readonly query?: Options['query']
  private readonly mindmap: Options['mindmap']
  private started = false
  private unsubs: Array<() => void> = []

  constructor({
    state,
    derived,
    node,
    edge,
    query,
    mindmap
  }: Options) {
    this.state = state
    this.derived = derived
    this.node = node
    this.edge = edge
    this.query = query
    this.mindmap = mindmap
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.unsubs = [
      this.state.watchChanges(this.handleStateChange)
    ]

    this.syncGraph({ fullSync: true })
    this.node.syncCanvasNodes()
    this.syncDerived('edge.paths')
    this.syncDerived('mindmap.trees')
  }

  stop = () => {
    if (!this.started && !this.unsubs.length) return
    this.started = false
    this.unsubs.forEach((off) => {
      off()
    })
    this.unsubs = []
  }

  syncGraph = (change: GraphChange) => {
    this.query?.syncGraph(change)
    this.edge.syncGraph(change)

    const graphDeps: ViewDependencyKey[] = []
    if (change.fullSync || change.visibleNodesChanged) {
      graphDeps.push('graph.visibleNodes')
    }
    if (change.fullSync || change.canvasNodesChanged) {
      graphDeps.push('graph.canvasNodes')
    }
    if (change.fullSync || change.visibleEdgesChanged) {
      graphDeps.push('graph.visibleEdges')
    }
    if (graphDeps.length) {
      this.derived.invalidateDependencies(graphDeps)
    }

    if (change.fullSync || change.canvasNodesChanged || change.visibleEdgesChanged) {
      this.syncDerived('edge.paths')
    }
    if (change.fullSync || change.visibleNodesChanged) {
      this.syncDerived('mindmap.trees')
    }

    const { dirtyNodeIds, orderChanged, fullSync, canvasNodesChanged } = change
    if (!fullSync && !canvasNodesChanged && !dirtyNodeIds?.length && !orderChanged) {
      return
    }

    this.node.syncCanvasNodes({
      dirtyNodeIds,
      orderChanged,
      fullSync
    })
  }

  syncState = (key: NodeStateSyncKey) => {
    this.node.syncState(key)
  }

  private readonly handleStateChange = (key: StateKey) => {
    if (key === 'viewport') {
      this.derived.invalidateDependencies(['viewport'])
      this.syncState('viewport')
      return
    }
    this.derived.invalidateDependencies([key])
    if (key === 'selection' || key === 'groupHovered' || key === 'tool') {
      this.syncState(key)
      return
    }
    if (key === 'edgeConnect') {
      this.syncDerived('edge.paths')
      return
    }
    if (key === 'mindmapLayout') {
      this.syncDerived('mindmap.trees')
    }
  }

  syncDerived = (key: DerivedSyncKey) => {
    if (key === 'edge.paths') {
      this.edge.sync()
      return
    }
    this.mindmap.sync()
  }
}
