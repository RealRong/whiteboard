import type { ReadControl, ReadDeps, ReadModel } from '@engine-types/read'
import type { EngineReadIndex } from '@engine-types/instance'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import {
  exportSliceFromEdge,
  exportSliceFromNodes
} from '@whiteboard/core/document'
import { DEFAULT_TUNING } from '../../config'
import { RESET_READ_IMPACT } from '../impacts'
import { NodeRectIndex, SnapIndex, TreeIndex } from '../indexes'
import { createEdgeProjection } from './edge'
import { createReadModel } from './model'
import { createMindmapProjection } from './mindmap'
import { createNodeProjection } from './node'
import { createTreeProjection } from './tree'
import type { ReadSnapshot } from './types'

export const createRead = ({
  document,
  mindmapLayout,
  config
}: ReadDeps): ReadControl => {
  const readDocument = document.get
  const readModel = createReadModel({ readDocument })

  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )
  const treeIndex = new TreeIndex()
  const indexes: EngineReadIndex = {
    node: {
      all: nodeRectIndex.all,
      get: nodeRectIndex.byId,
      idsInRect: nodeRectIndex.nodeIdsInRect
    },
    snap: {
      all: snapIndex.all,
      inRect: snapIndex.queryInRect
    },
    tree: {
      list: treeIndex.ids,
      has: treeIndex.has
    }
  }

  const createSnapshot = (model: ReadModel): ReadSnapshot => ({
    model,
    indexes
  })

  const syncIndexes = (impact: KernelReadImpact, model: ReadModel) => {
    nodeRectIndex.applyChange(impact, model)
    snapIndex.applyChange(impact, {
      all: nodeRectIndex.all,
      get: nodeRectIndex.byId
    })
    treeIndex.applyChange(model)
  }

  const initialModel = readModel()
  syncIndexes(RESET_READ_IMPACT, initialModel)
  const initialSnapshot = createSnapshot(initialModel)

  const nodeProjection = createNodeProjection(initialSnapshot)
  const edgeProjection = createEdgeProjection(initialSnapshot)
  const mindmapProjection = createMindmapProjection(initialSnapshot, {
    config,
    mindmapLayout
  })
  const treeProjection = createTreeProjection(initialSnapshot)

  const applyImpact = (impact: KernelReadImpact) => {
    const model = readModel()
    syncIndexes(impact, model)
    const snapshot = createSnapshot(model)
    nodeProjection.applyChange(impact, snapshot)
    edgeProjection.applyChange(impact, snapshot)
    mindmapProjection.applyChange(impact, snapshot)
    treeProjection.applyChange(impact, snapshot)
  }

  return {
    read: {
      node: {
        list: nodeProjection.list,
        item: nodeProjection.item
      },
      edge: {
        list: edgeProjection.list,
        item: edgeProjection.item,
        related: edgeProjection.related
      },
      mindmap: {
        list: mindmapProjection.list,
        item: mindmapProjection.item
      },
      tree: treeProjection.item,
      slice: {
        fromNodes: (nodeIds) => {
          const exported = exportSliceFromNodes({
            doc: readDocument(),
            ids: nodeIds,
            nodeSize: config.nodeSize
          })
          return exported.ok ? exported.data : undefined
        },
        fromEdge: (edgeId) => {
          const exported = exportSliceFromEdge({
            doc: readDocument(),
            edgeId,
            nodeSize: config.nodeSize
          })
          return exported.ok ? exported.data : undefined
        }
      },
      index: indexes
    },
    invalidate: applyImpact
  }
}
