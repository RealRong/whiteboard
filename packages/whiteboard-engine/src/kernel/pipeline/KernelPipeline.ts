import type { GraphChange } from '@engine-types/graph'
import type { State, StateKey } from '@engine-types/instance/state'
import { toChangeView } from '../../graph/change'
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

    this.syncGraph({
      source: 'runtime',
      kind: 'full',
      projection: {
        visibleNodesChanged: true,
        canvasNodesChanged: true,
        visibleEdgesChanged: true
      }
    })
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

    const {
      fullSync,
      visibleNodesChanged,
      canvasNodesChanged,
      visibleEdgesChanged,
      dirtyNodeIds,
      orderChanged
    } = toChangeView(change)

    const graphDeps: ViewDependencyKey[] = []
    if (fullSync || visibleNodesChanged) {
      graphDeps.push('graph.visibleNodes')
    }
    if (fullSync || canvasNodesChanged) {
      graphDeps.push('graph.canvasNodes')
    }
    if (fullSync || visibleEdgesChanged) {
      graphDeps.push('graph.visibleEdges')
    }
    if (graphDeps.length) {
      this.derived.invalidateDependencies(graphDeps)
    }

    if (fullSync || canvasNodesChanged || visibleEdgesChanged) {
      this.syncDerived('edge.paths')
    }
    if (fullSync || visibleNodesChanged) {
      this.syncDerived('mindmap.trees')
    }

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
