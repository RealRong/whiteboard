import { getDefaultStore } from 'jotai'
import type { WhiteboardStateKey, WhiteboardStateNamespace, WhiteboardStateSnapshot } from '@engine-types/instance'
import { WHITEBOARD_STATE_KEYS, whiteboardStateAtoms } from '../../state'
import { setStoreAtom } from '../store/setStoreAtom'

type WhiteboardStateNamespaceFactoryResult = {
  state: WhiteboardStateNamespace
  readState: WhiteboardStateNamespace['read']
  writeState: WhiteboardStateNamespace['write']
}

export const createWhiteboardStateNamespace = (): WhiteboardStateNamespaceFactoryResult => {
  const store = getDefaultStore()
  const getStateAtom = (key: WhiteboardStateKey) => whiteboardStateAtoms[key]

  const readState = ((key: WhiteboardStateKey) =>
    store.get(getStateAtom(key) as never)) as WhiteboardStateNamespace['read']

  const watchState: WhiteboardStateNamespace['watch'] = (key, listener) => {
    return store.sub(getStateAtom(key) as never, listener)
  }

  const writeState: WhiteboardStateNamespace['write'] = (key, next) => {
    setStoreAtom(store, getStateAtom(key) as never, next as never)
  }

  const getStateSnapshot = (): WhiteboardStateSnapshot =>
    Object.fromEntries(WHITEBOARD_STATE_KEYS.map((key) => [key, readState(key)])) as WhiteboardStateSnapshot

  const state: WhiteboardStateNamespace = {
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
