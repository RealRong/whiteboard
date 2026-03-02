import type { ReadRuntimeContext } from '../context'
import type { ReadDomain } from '../domainTypes'
import { atoms as createMindmapAtoms } from './atoms'
import { projection as createMindmapProjection } from './projection'

type MindmapReadAtomKey = 'mindmapIds' | 'mindmapById'

type MindmapReadGetterKey = MindmapReadAtomKey

export type MindmapReadDomain = ReadDomain<
  MindmapReadAtomKey,
  MindmapReadGetterKey
>

export const domain = (context: ReadRuntimeContext): MindmapReadDomain => {
  const mindmapProjection = createMindmapProjection(context)

  const derivedAtoms = createMindmapAtoms(context, mindmapProjection)

  return {
    atoms: derivedAtoms,
    get: {
      mindmapIds: () => context.store.get(derivedAtoms.mindmapIds),
      mindmapById: (id) => context.store.get(derivedAtoms.mindmapById(id))
    },
    applyChange: () => {}
  }
}
