import type { NodeId } from '@whiteboard/core'
import type {
  GraphChange,
  GraphChangeSource,
  GraphHint,
  GraphProjectionChange
} from './types'

type SourceState = {
  dirtyNodeIds: Set<NodeId>
  orderChanged: boolean
  fullSync: boolean
}

const createSourceState = (): SourceState => ({
  dirtyNodeIds: new Set<NodeId>(),
  orderChanged: false,
  fullSync: false
})

export class PendingState {
  private readonly stateBySource: Record<GraphChangeSource, SourceState> = {
    runtime: createSourceState(),
    doc: createSourceState()
  }

  private readState = (source: GraphChangeSource) => this.stateBySource[source]

  applyHint = (hint: GraphHint, source: GraphChangeSource) => {
    const state = this.readState(source)
    if (hint.kind === 'full') {
      state.fullSync = true
      state.dirtyNodeIds.clear()
      state.orderChanged = false
      return
    }

    if (state.fullSync) {
      return
    }

    if (hint.dirtyNodeIds?.length) {
      hint.dirtyNodeIds.forEach((nodeId) => {
        state.dirtyNodeIds.add(nodeId)
      })
    }
    if (hint.orderChanged) {
      state.orderChanged = true
    }
  }

  toChange = (
    source: GraphChangeSource,
    projection: GraphProjectionChange
  ): GraphChange => {
    const state = this.readState(source)

    if (state.fullSync) {
      return {
        source,
        kind: 'full',
        projection: {
          visibleNodesChanged: true,
          canvasNodesChanged: true,
          visibleEdgesChanged: true
        }
      }
    }

    return {
      source,
      kind: 'partial',
      projection,
      dirtyNodeIds: state.dirtyNodeIds.size
        ? Array.from(state.dirtyNodeIds)
        : undefined,
      orderChanged: state.orderChanged ? true : undefined
    }
  }

  clear = (source: GraphChangeSource) => {
    const state = this.readState(source)
    state.dirtyNodeIds.clear()
    state.orderChanged = false
    state.fullSync = false
  }
}
