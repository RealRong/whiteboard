import { type createStore } from 'jotai/vanilla'
import { atom } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { State } from '@engine-types/instance/state'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms/read'
import type { Change } from '../write/pipeline/ChangeBus'
import { model as edgeModel } from './edge/model'
import { view as edgeView } from './edge/view'
import { domain as nodeDomain } from './node/domain'
import { domain as mindmapDomain } from './mindmap/domain'

type Options = {
  state: State
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  readAtoms: ReadAtoms
  config: InstanceConfig
  getNodeRect: QueryCanvas['nodeRect']
}

export type ReadStore = {
  read: EngineRead
  applyChange: (change: Change) => void
}

const shouldBumpEdgeRevision = (change: Change) => {
  if (change.kind === 'replace') return true
  const { impact } = change
  if (
    impact.tags.has('full') ||
    impact.tags.has('edges') ||
    impact.tags.has('mindmap') ||
    impact.tags.has('geometry')
  ) {
    return true
  }
  return Boolean(impact.dirtyNodeIds?.length || impact.dirtyEdgeIds?.length)
}

export const store = ({
  state,
  runtimeStore,
  stateAtoms,
  readAtoms,
  config,
  getNodeRect
}: Options): ReadStore => {
  const runtime = runtimeStore
  const readSnapshotAtom = readAtoms.snapshot

  const readSnapshot = (): ReadModelSnapshot => runtime.get(readSnapshotAtom)

  const edgeRevisionAtom = atom(0)
  const edge = edgeModel({
    readSnapshot,
    getNodeRect
  })
  const edgeAtoms = edgeView({
    selectionAtom: stateAtoms.selection,
    edgeRevisionAtom,
    getEdgeIds: edge.getIds,
    getEdgeById: edge.getById,
    getEdgeEndpoints: edge.getEndpoints
  })

  const node = nodeDomain({
    store: runtime,
    viewportAtom: stateAtoms.viewport,
    readSnapshotAtom,
    readSnapshot,
    getNodeRect
  })

  const mindmap = mindmapDomain({
    store: runtime,
    readState: state.read,
    readSnapshot,
    readSnapshotAtom,
    mindmapLayoutAtom: stateAtoms.mindmapLayout,
    config
  })

  const applyChange: ReadStore['applyChange'] = (change) => {
    edge.applyChange(change)
    if (shouldBumpEdgeRevision(change)) {
      runtime.set(edgeRevisionAtom, (previous: number) => previous + 1)
    }
    node.applyChange?.(change)
    mindmap.applyChange?.(change)
  }

  const atoms = {
    interaction: stateAtoms.interaction,
    tool: stateAtoms.tool,
    selection: stateAtoms.selection,
    viewport: stateAtoms.viewport,
    mindmapLayout: stateAtoms.mindmapLayout,
    ...node.atoms,
    ...edgeAtoms,
    ...mindmap.atoms
  }

  return {
    applyChange,
    read: {
      store: runtime,
      atoms,
      get: {
        viewportTransform: node.get.viewportTransform,
        nodeIds: node.get.nodeIds,
        nodeById: node.get.nodeById,
        edgeIds: () => runtime.get(edgeAtoms.edgeIds),
        edgeById: (id) => runtime.get(edgeAtoms.edgeById(id)),
        selectedEdgeId: () => runtime.get(edgeAtoms.selectedEdgeId),
        edgeSelectedEndpoints: () => runtime.get(edgeAtoms.edgeSelectedEndpoints),
        mindmapIds: mindmap.get.mindmapIds,
        mindmapById: mindmap.get.mindmapById
      }
    }
  }
}
