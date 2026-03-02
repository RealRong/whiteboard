import type { ReadRuntimeContext } from '../context'
import type { EngineReadGetters } from '@engine-types/instance/read'
import type { ReadChangePlan } from '../changePlan'
import { atoms as createMindmapAtoms } from './atoms'
import { cache as createMindmapCache } from './cache'

type MindmapReadGet = Pick<EngineReadGetters, 'mindmapIds' | 'mindmapById'>

export type MindmapReadRuntime = {
  get: MindmapReadGet
  applyChange: (plan: ReadChangePlan) => void
}

export const runtime = (context: ReadRuntimeContext): MindmapReadRuntime => {
  const mindmapCache = createMindmapCache(context)

  const derivedAtoms = createMindmapAtoms(context, mindmapCache)

  return {
    get: {
      mindmapIds: () => context.store.get(derivedAtoms.mindmapIds),
      mindmapById: (id) => context.store.get(derivedAtoms.mindmapById(id))
    },
    applyChange: () => {}
  }
}
