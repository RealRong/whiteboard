import type { ReadControl, ReadDeps, ReadModel } from '@engine-types/read'
import type { EngineReadIndex } from '@engine-types/instance'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
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

  const initialModel = readModel()
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
    nodeRectIndex.applyChange(impact, model)
    snapIndex.applyChange(impact, {
      all: nodeRectIndex.all,
      get: nodeRectIndex.byId
    })
    treeIndex.applyChange(model)
    const snapshot = createSnapshot(model)
    nodeProjection.applyChange(impact, snapshot)
    edgeProjection.applyChange(impact, snapshot)
    mindmapProjection.applyChange(impact, snapshot)
    treeProjection.applyChange(impact, snapshot)
  }

  applyImpact(RESET_READ_IMPACT)

  return {
    read: {
      node: {
        list: {
          get: nodeProjection.ids,
          subscribe: nodeProjection.subscribeIds
        },
        item: {
          get: nodeProjection.get,
          subscribe: nodeProjection.subscribe
        }
      },
      edge: {
        list: {
          get: edgeProjection.ids,
          subscribe: edgeProjection.subscribeIds
        },
        item: {
          get: edgeProjection.get,
          subscribe: edgeProjection.subscribe
        }
      },
      mindmap: {
        list: {
          get: mindmapProjection.ids,
          subscribe: mindmapProjection.subscribeIds
        },
        item: {
          get: mindmapProjection.get,
          subscribe: mindmapProjection.subscribe
        }
      },
      tree: {
        get: treeProjection.get,
        subscribe: treeProjection.subscribe
      },
      index: indexes
    },
    invalidate: applyImpact
  }
}
