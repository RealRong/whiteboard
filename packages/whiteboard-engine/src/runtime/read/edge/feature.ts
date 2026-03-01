import type { NodeId } from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { ReadRuntimeContext } from '../context'
import type { ReadMutableFeature } from '../featureTypes'
import { model as createEdgeModel } from './model'
import { toEdgeChangePlan } from './policy'
import { view as createEdgeView } from './view'

type EdgeReadAtomKey =
  | 'edgeIds'
  | 'edgeById'
  | 'selectedEdgeId'
  | 'edgeSelectedEndpoints'

type EdgeReadGetterKey = EdgeReadAtomKey

export type EdgeReadFeature = ReadMutableFeature<
  EdgeReadAtomKey,
  EdgeReadGetterKey
>

export const feature = (context: ReadRuntimeContext): EdgeReadFeature => {
  const readSnapshot = (): ReadModelSnapshot => context.get('snapshot')
  const model = createEdgeModel({ getNodeRect: context.query.nodeRect })

  let visibleEdgesRef: ReadModelSnapshot['edges']['visible'] | undefined
  let pendingDirtyNodeIds = new Set<NodeId>()

  const ensureEntries = () => {
    const edges = readSnapshot().edges.visible
    if (edges !== visibleEdgesRef) {
      visibleEdgesRef = edges
      pendingDirtyNodeIds = new Set<NodeId>()
      model.rebuildAll(edges)
      return
    }

    if (!pendingDirtyNodeIds.size) return
    const dirtyNodeIds = pendingDirtyNodeIds
    pendingDirtyNodeIds = new Set<NodeId>()
    model.updateByDirtyNodeIds(dirtyNodeIds)
  }

  const atoms = createEdgeView({
    selectionAtom: context.atom('selection'),
    edgeRevisionAtom: context.atom('signal.edgeRevision'),
    getSnapshot: () => {
      ensureEntries()
      return model.getSnapshot()
    }
  })

  const applyChange: EdgeReadFeature['applyChange'] = (change) => {
    const plan = toEdgeChangePlan(change)

    if (plan.clearPendingDirtyNodeIds) {
      visibleEdgesRef = undefined
      pendingDirtyNodeIds = new Set<NodeId>()
    } else {
      if (plan.resetVisibleEdges) {
        visibleEdgesRef = undefined
      }
      if (plan.appendDirtyNodeIds.length) {
        plan.appendDirtyNodeIds.forEach((nodeId) => {
          pendingDirtyNodeIds.add(nodeId)
        })
      }
    }

    if (plan.bumpRevision) {
      context.setSignal('signal.edgeRevision', (previous: number) => previous + 1)
    }
  }

  return {
    atoms,
    get: {
      edgeIds: () => context.readAtom(atoms.edgeIds),
      edgeById: (id) => context.readAtom(atoms.edgeById(id)),
      selectedEdgeId: () => context.readAtom(atoms.selectedEdgeId),
      edgeSelectedEndpoints: () => context.readAtom(atoms.edgeSelectedEndpoints)
    },
    applyChange
  }
}
