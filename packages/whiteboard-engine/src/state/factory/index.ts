import { getDefaultStore } from 'jotai'
import type { StateKey, State, StateSnapshot } from '@engine-types/instance'
import { STATE_KEYS, stateAtoms } from '..'
import { setStoreAtom } from '../setAtom'

type Result = {
  state: State
  readState: State['read']
  writeState: State['write']
}

export const createState = (): Result => {
  const store = getDefaultStore()
  const getStateAtom = (key: StateKey) => stateAtoms[key]

  const readState = ((key: StateKey) =>
    store.get(getStateAtom(key) as never)) as State['read']

  const watchState: State['watch'] = (key, listener) => {
    return store.sub(getStateAtom(key) as never, listener)
  }

  const writeState: State['write'] = (key, next) => {
    setStoreAtom(store, getStateAtom(key) as never, next as never)
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
