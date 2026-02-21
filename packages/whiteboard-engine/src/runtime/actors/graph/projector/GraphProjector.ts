import type { Document } from '@whiteboard/core'
import { hasProjectionChange } from './ProjectionChange'
import { GraphCache } from '../cache/GraphCache'
import { PendingState } from './PendingState'
import type {
  GraphChange,
  GraphChangeSource,
  GraphProjectionChange,
} from '../types'
import type { GraphProjector as GraphProjectorType } from '../types'

export class GraphProjector implements GraphProjectorType {
  private readonly cache = new GraphCache()
  private readonly pendingState = new PendingState()
  private currentSnapshot = this.cache.read(this.getDoc())

  constructor(private readonly getDoc: () => Document | null) {}

  read: GraphProjectorType['read'] = () => {
    this.currentSnapshot = this.cache.read(this.getDoc())
    return this.currentSnapshot
  }

  readNode: GraphProjectorType['readNode'] = (nodeId) =>
    this.cache.readNode(this.getDoc(), nodeId)

  readNodeOverrides: GraphProjectorType['readNodeOverrides'] = () =>
    this.cache.readNodeOverrides()

  applyHint: GraphProjectorType['applyHint'] = (
    hint,
    source = 'doc'
  ) => {
    this.pendingState.applyHint(hint, source)
  }

  flush: GraphProjectorType['flush'] = (source) => {
    const previous = this.currentSnapshot
    const next = this.cache.read(this.getDoc())
    this.currentSnapshot = next
    const payload = this.toChange(source, {
      visibleNodesChanged: previous.visibleNodes !== next.visibleNodes,
      canvasNodesChanged: previous.canvasNodes !== next.canvasNodes,
      visibleEdgesChanged: previous.visibleEdges !== next.visibleEdges
    })
    const changed = payload.kind === 'full' || hasProjectionChange(payload)
    this.pendingState.clear(source)
    if (!changed) return undefined
    return payload
  }

  patchNodeOverrides: GraphProjectorType['patchNodeOverrides'] = (updates) => {
    const changedNodeIds = this.cache.patchNodeOverrides(updates)
    if (!changedNodeIds.length) return undefined
    this.applyHint(
      {
        kind: 'partial',
        dirtyNodeIds: changedNodeIds
      },
      'runtime'
    )
    return this.flush('runtime')
  }

  clearNodeOverrides: GraphProjectorType['clearNodeOverrides'] = (ids) => {
    const changedNodeIds = this.cache.clearNodeOverrides(ids)
    if (!changedNodeIds.length) return undefined
    this.applyHint(
      {
        kind: 'partial',
        dirtyNodeIds: changedNodeIds
      },
      'runtime'
    )
    return this.flush('runtime')
  }

  private toChange = (
    source: GraphChangeSource,
    projection: GraphProjectionChange
  ): GraphChange => this.pendingState.toChange(source, projection)
}
