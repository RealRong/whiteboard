import { useMemo, useRef } from 'react'
import { atom, useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import type { Atom } from 'jotai/vanilla'
import type { StateKey, StateSnapshot } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Selector<T> = (snapshot: StateSnapshot) => T
type Equality<T> = (left: T, right: T) => boolean
type SelectorOptions<T> = {
  keys: StateKey[]
  equality?: Equality<T>
}

type StateAtoms = {
  interaction: Atom<StateSnapshot['interaction']>
  tool: Atom<StateSnapshot['tool']>
  selection: Atom<StateSnapshot['selection']>
  viewport: Atom<StateSnapshot['viewport']>
  mindmapLayout: Atom<StateSnapshot['mindmapLayout']>
}

const defaultEquality: Equality<unknown> = Object.is

const isSameKeys = (left: StateKey[], right: StateKey[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const normalizeKeys = (keys: StateKey[]) => Array.from(new Set(keys))

const getStateAtomByKey = <K extends StateKey>(
  atoms: StateAtoms,
  key: K
): Atom<StateSnapshot[K]> => {
  if (key === 'interaction') return atoms.interaction as Atom<StateSnapshot[K]>
  if (key === 'tool') return atoms.tool as Atom<StateSnapshot[K]>
  if (key === 'selection') return atoms.selection as Atom<StateSnapshot[K]>
  if (key === 'viewport') return atoms.viewport as Atom<StateSnapshot[K]>
  return atoms.mindmapLayout as Atom<StateSnapshot[K]>
}

const readSnapshotByKeys = (
  get: <T>(atom: Atom<T>) => T,
  atoms: StateAtoms,
  keys: StateKey[]
): StateSnapshot => {
  const snapshot = {} as StateSnapshot
  const target = snapshot as Record<StateKey, StateSnapshot[StateKey]>
  keys.forEach((stateKey) => {
    target[stateKey] = get(getStateAtomByKey(atoms, stateKey))
  })
  return snapshot
}

export function useWhiteboardSelector<K extends StateKey>(key: K): StateSnapshot[K]
export function useWhiteboardSelector<T>(selector: Selector<T>, options: SelectorOptions<T>): T

export function useWhiteboardSelector<T>(
  keyOrSelector: StateKey | Selector<T>,
  options?: SelectorOptions<T>
): T {
  const instance = useInstance()
  const isKeySelector = typeof keyOrSelector === 'string'
  const key = isKeySelector ? (keyOrSelector as StateKey) : undefined

  if (!isKeySelector && (!options?.keys || options.keys.length === 0)) {
    throw new Error('useWhiteboardSelector(selector) requires explicit keys')
  }

  const selector: Selector<T> = isKeySelector
    ? ((snapshot) => snapshot[keyOrSelector] as T)
    : keyOrSelector

  const computedKeys = useMemo(
    () => normalizeKeys(isKeySelector ? [key as StateKey] : options!.keys),
    [isKeySelector, key, options?.keys]
  )

  const keysRef = useRef<StateKey[]>(computedKeys)
  if (!isSameKeys(keysRef.current, computedKeys)) {
    keysRef.current = computedKeys
  }
  const keys = keysRef.current

  const selectorRef = useRef(selector)
  const equalityRef = useRef((options?.equality ?? defaultEquality) as Equality<T>)
  selectorRef.current = selector
  equalityRef.current = (options?.equality ?? defaultEquality) as Equality<T>

  const stateAtoms = instance.read.atoms as StateAtoms
  const snapshotAtom = useMemo(
    () => atom((get) => readSnapshotByKeys(get, stateAtoms, keys)),
    [keys, stateAtoms]
  )

  const selectedAtom = useMemo(
    () =>
      selectAtom(
        snapshotAtom,
        (snapshot) => selectorRef.current(snapshot),
        (left, right) => equalityRef.current(left, right)
      ),
    [snapshotAtom]
  )

  return useAtomValue(selectedAtom)
}
