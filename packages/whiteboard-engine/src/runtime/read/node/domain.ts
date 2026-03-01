import type { ReadRuntimeContext } from '../context'
import type { ReadDomain } from '../domainTypes'
import { atoms as createNodeAtoms } from './atoms'

type NodeReadAtomKey = 'viewportTransform' | 'nodeIds' | 'nodeById'

type NodeReadGetterKey = NodeReadAtomKey

export type NodeReadDomain = ReadDomain<NodeReadAtomKey, NodeReadGetterKey>

export const domain = (context: ReadRuntimeContext): NodeReadDomain => {
  const derivedAtoms = createNodeAtoms(context)

  return {
    atoms: derivedAtoms,
    get: {
      viewportTransform: () => context.store.get(derivedAtoms.viewportTransform),
      nodeIds: () => context.store.get(derivedAtoms.nodeIds),
      nodeById: (id) => context.store.get(derivedAtoms.nodeById(id))
    },
    applyChange: () => {}
  }
}
