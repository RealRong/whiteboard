import { type createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { State } from '@engine-types/instance/state'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms/createReadAtoms'
import type { Change } from '../write/pipeline/ChangeBus'
import { createEdgeReadDomain } from './edge/createEdgeReadDomain'
import { createNodeReadDomain } from './node/createNodeReadDomain'
import { createMindmapReadDomain } from './mindmap/createMindmapReadDomain'

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

export const createReadStore = ({
  state,
  runtimeStore,
  stateAtoms,
  readAtoms,
  config,
  getNodeRect
}: Options): ReadStore => {
  const store = runtimeStore
  const readSnapshotAtom = readAtoms.snapshot

  const readSnapshot = (): ReadModelSnapshot => store.get(readSnapshotAtom)

  const edgeDomain = createEdgeReadDomain({
    store,
    selectionAtom: stateAtoms.selection,
    readSnapshot,
    getNodeRect
  })

  const nodeDomain = createNodeReadDomain({
    store,
    viewportAtom: stateAtoms.viewport,
    readSnapshotAtom,
    readSnapshot,
    getNodeRect
  })

  const mindmapDomain = createMindmapReadDomain({
    store,
    readState: state.read,
    readSnapshot,
    readSnapshotAtom,
    mindmapLayoutAtom: stateAtoms.mindmapLayout,
    config
  })

  const applyChange: ReadStore['applyChange'] = (change) => {
    edgeDomain.applyChange(change)
    nodeDomain.applyChange(change)
    mindmapDomain.applyChange(change)
  }

  const atoms = {
    interaction: stateAtoms.interaction,
    tool: stateAtoms.tool,
    selection: stateAtoms.selection,
    viewport: stateAtoms.viewport,
    mindmapLayout: stateAtoms.mindmapLayout,
    ...nodeDomain.atoms,
    ...edgeDomain.atoms,
    ...mindmapDomain.atoms
  }

  return {
    applyChange,
    read: {
      store,
      atoms,
      get: {
        viewportTransform: nodeDomain.get.viewportTransform,
        nodeIds: nodeDomain.get.nodeIds,
        nodeById: nodeDomain.get.nodeById,
        edgeIds: edgeDomain.get.edgeIds,
        edgeById: edgeDomain.get.edgeById,
        selectedEdgeId: edgeDomain.get.selectedEdgeId,
        edgeSelectedEndpoints: edgeDomain.get.edgeSelectedEndpoints,
        mindmapIds: mindmapDomain.get.mindmapIds,
        mindmapById: mindmapDomain.get.mindmapById
      }
    }
  }
}
