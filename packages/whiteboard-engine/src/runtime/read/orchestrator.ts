import type { Document, Node, NodeId } from '@whiteboard/core/types'
import type { createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { CanvasNodeRect, EngineRead } from '@engine-types/instance/read'
import type { SnapCandidate } from '@engine-types/node/snap'
import type { ViewportApi } from '@engine-types/viewport'
import {
  getAnchorFromPoint as getAnchorFromPointRaw,
  getNearestEdgeSegment as getNearestEdgeSegmentRaw
} from '@whiteboard/core/edge'
import { getNodeIdsInRect as getNodeIdsInRectRaw } from '@whiteboard/core/node'
import { DEFAULT_TUNING } from '../../config'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms'
import type { Change } from '../write/pipeline/ChangeBus'
import { hasImpactTag } from '../write/mutation/Impact'
import { store as readStore } from './store'
import { NodeRectIndex } from './index/NodeRectIndex'
import { SnapIndex } from './index/SnapIndex'

type Options = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  readAtoms: ReadAtoms
  config: InstanceConfig
  readDoc: () => Document
  viewport: ViewportApi
}

export type ReadRuntime = {
  query: Query
  read: EngineRead
  applyChange: (change: Change) => void
}

export const runtime = ({
  runtimeStore,
  stateAtoms,
  readAtoms,
  config,
  readDoc,
  viewport
}: Options): ReadRuntime => {
  let snapshot = runtimeStore.get(readAtoms.snapshot)

  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(() =>
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )
  const syncIndex = (nodes: Node[]) => {
    nodeRectIndex.updateFull(nodes)
    snapIndex.update(nodeRectIndex.getAll())
  }
  const syncIndexByNodeIds = (
    nodeIds: Iterable<NodeId>,
    nodeById: ReadonlyMap<NodeId, Node>
  ) => {
    const changed = nodeRectIndex.updateByIds(nodeIds, nodeById)
    if (!changed) return
    snapIndex.updateByNodeIds(nodeIds, nodeRectIndex.getById)
  }

  syncIndex(snapshot.nodes.canvas)

  const nodeRects: Query['canvas']['nodeRects'] = (): CanvasNodeRect[] =>
    nodeRectIndex.getAll()
  const nodeRect: Query['canvas']['nodeRect'] = (nodeId) =>
    nodeRectIndex.getById(nodeId)
  const nodeIdsInRect: Query['canvas']['nodeIdsInRect'] = (rect) =>
    getNodeIdsInRectRaw(rect, nodeRects())

  const snapCandidates: Query['snap']['candidates'] = (): SnapCandidate[] =>
    snapIndex.getAll()
  const snapCandidatesInRect: Query['snap']['candidatesInRect'] = (rect) =>
    snapIndex.queryInRect(rect)

  const query: Query = {
    doc: { get: readDoc },
    viewport: {
      get: viewport.get,
      getZoom: viewport.getZoom,
      screenToWorld: viewport.screenToWorld,
      worldToScreen: viewport.worldToScreen,
      clientToScreen: viewport.clientToScreen,
      clientToWorld: viewport.clientToWorld,
      getScreenCenter: viewport.getScreenCenter,
      getContainerSize: viewport.getContainerSize
    },
    config: { get: () => config },
    canvas: {
      nodeRects,
      nodeRect,
      nodeIdsInRect
    },
    snap: {
      candidates: snapCandidates,
      candidatesInRect: snapCandidatesInRect
    },
    geometry: {
      anchorFromPoint: (rect, rotation, point) =>
        getAnchorFromPointRaw(rect, rotation, point, {
          snapMin: config.edge.anchorSnapMin,
          snapRatio: config.edge.anchorSnapRatio,
          anchorOffset: DEFAULT_TUNING.edge.anchorOffset
        }),
      nearestEdgeSegment: (pointWorld, pathPoints) =>
        getNearestEdgeSegmentRaw(pointWorld, pathPoints)
    }
  }

  const readLayer = readStore({
    runtimeStore,
    stateAtoms,
    readAtoms,
    config,
    getNodeRect: nodeRect
  })

  const applyIndexChange = (change: Change) => {
    snapshot = runtimeStore.get(readAtoms.snapshot)
    const impact = change.impact
    if (change.kind === 'replace' || hasImpactTag(impact, 'full')) {
      syncIndex(snapshot.nodes.canvas)
      return
    }
    if (hasImpactTag(impact, 'order') && !hasImpactTag(impact, 'edges')) {
      syncIndex(snapshot.nodes.canvas)
      return
    }
    if (impact.dirtyNodeIds?.length) {
      syncIndexByNodeIds(impact.dirtyNodeIds, snapshot.indexes.canvasNodeById)
      return
    }
    if (hasImpactTag(impact, 'geometry') || hasImpactTag(impact, 'mindmap')) {
      syncIndex(snapshot.nodes.canvas)
    }
  }

  return {
    query,
    read: readLayer.read,
    applyChange: (change) => {
      applyIndexChange(change)
      readLayer.applyChange(change)
    }
  }
}
