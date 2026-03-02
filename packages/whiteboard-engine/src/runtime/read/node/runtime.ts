import type { ReadRuntimeContext } from '../context'
import type { EngineReadGetters } from '@engine-types/instance/read'
import type { ReadChangePlan } from '../changePlan'
import { atoms as createNodeAtoms } from './atoms'

type NodeReadGet = Pick<
  EngineReadGetters,
  'viewportTransform' | 'nodeIds' | 'nodeById'
>

export type NodeReadRuntime = {
  get: NodeReadGet
  applyChange: (plan: ReadChangePlan) => void
}

export const runtime = (context: ReadRuntimeContext): NodeReadRuntime => {
  const derivedAtoms = createNodeAtoms(context)

  return {
    get: {
      viewportTransform: () => context.store.get(derivedAtoms.viewportTransform),
      nodeIds: () => context.store.get(derivedAtoms.nodeIds),
      nodeById: (id) => context.store.get(derivedAtoms.nodeById(id))
    },
    applyChange: () => {}
  }
}
