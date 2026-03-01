import type { EngineReadAtoms, EngineReadGetters } from '@engine-types/instance/read'
import type { ReadChangePlan } from './changePlan'

// Runtime modules expose atoms/getters slices only; dependencies are injected via ReadRuntimeContext.
export type ReadAtomsSlice<TKey extends keyof EngineReadAtoms> = Pick<
  EngineReadAtoms,
  TKey
>

export type ReadGettersSlice<TKey extends keyof EngineReadGetters> = Pick<
  EngineReadGetters,
  TKey
>

export type ReadDomain<
  TAtomKey extends keyof EngineReadAtoms,
  TGetterKey extends keyof EngineReadGetters
> = {
  atoms: ReadAtomsSlice<TAtomKey>
  get: ReadGettersSlice<TGetterKey>
  applyChange: (plan: ReadChangePlan) => void
}
