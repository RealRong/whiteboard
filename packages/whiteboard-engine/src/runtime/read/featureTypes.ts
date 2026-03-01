import type { EngineReadAtoms, EngineReadGetters } from '@engine-types/instance/read'
import type { Change } from '../write/pipeline/ChangeBus'

export type ReadAtomsSlice<TKey extends keyof EngineReadAtoms> = Pick<
  EngineReadAtoms,
  TKey
>

export type ReadGettersSlice<TKey extends keyof EngineReadGetters> = Pick<
  EngineReadGetters,
  TKey
>

export type ReadFeature<
  TAtomKey extends keyof EngineReadAtoms,
  TGetterKey extends keyof EngineReadGetters
> = {
  atoms: ReadAtomsSlice<TAtomKey>
  get: ReadGettersSlice<TGetterKey>
}

export type ReadMutableFeature<
  TAtomKey extends keyof EngineReadAtoms,
  TGetterKey extends keyof EngineReadGetters
> = ReadFeature<TAtomKey, TGetterKey> & {
  applyChange: (change: Change) => void
}
