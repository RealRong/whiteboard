import { getDefaultStore } from 'jotai'
import type {
  State,
  StateKey,
  StateSnapshot,
  WritableStateKey
} from '@engine-types/instance'
import { writableStateAtoms } from '../atoms'
import { STATE_KEYS, stateAtoms } from '../stateAtomMap'

type Result = {
  state: State
  readState: State['read']
  writeState: State['write']
}

export const createState = (): Result => {
  const store = getDefaultStore()
  const getStateAtom = (key: StateKey) => stateAtoms[key]
  const getWritableStateAtom = (key: WritableStateKey) => writableStateAtoms[key]

  const readState = ((key: StateKey) =>
    store.get(getStateAtom(key) as never)) as State['read']

  const watchState: State['watch'] = (key, listener) => {
    return store.sub(getStateAtom(key) as never, listener)
  }

  const writeState: State['write'] = (key, next) => {
    store.set(getWritableStateAtom(key) as any, next)
  }

  const getStateSnapshot = (): StateSnapshot =>
    Object.fromEntries(STATE_KEYS.map((key) => [key, readState(key)])) as StateSnapshot

  const state: State = {
    store,
    read: readState,
    write: writeState,
    watch: watchState,
    snapshot: getStateSnapshot
  }

  return {
    state,
    readState,
    writeState
  }
}
