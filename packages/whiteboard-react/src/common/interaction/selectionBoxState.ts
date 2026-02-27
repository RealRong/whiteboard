import { useRef } from 'react'
import { atom, useAtomValue } from 'jotai'
import type { Rect } from '@whiteboard/core/types'
import type { Instance } from '@whiteboard/engine'

type SelectionBoxSnapshot = {
  rect?: Rect
}

type Equality<T> = (left: T, right: T) => boolean

const defaultEquality: Equality<unknown> = Object.is
const EMPTY_SNAPSHOT: SelectionBoxSnapshot = {}

const selectionBoxAtom = atom<SelectionBoxSnapshot>(EMPTY_SNAPSHOT)

const readSnapshot = (instance: Instance) => instance.runtime.store.get(selectionBoxAtom)

const writeSnapshot = (instance: Instance, next: SelectionBoxSnapshot) => {
  instance.runtime.store.set(selectionBoxAtom, next)
}

const setSnapshot = (instance: Instance, next: SelectionBoxSnapshot) => {
  const snapshot = readSnapshot(instance)
  if (snapshot.rect === next.rect) return
  writeSnapshot(instance, next)
}

export const selectionBoxState = {
  subscribe: (instance: Instance, listener: () => void) =>
    instance.runtime.store.sub(selectionBoxAtom, listener),
  getSnapshot: (instance: Instance) => readSnapshot(instance),
  setRect: (instance: Instance, rect: Rect) => {
    setSnapshot(instance, { rect })
  },
  clear: (instance: Instance) => {
    const snapshot = readSnapshot(instance)
    if (!snapshot.rect) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}

export const useSelectionBoxSelector = <T,>(
  selector: (snapshot: SelectionBoxSnapshot) => T,
  equality?: Equality<T>
) => {
  const snapshot = useAtomValue(selectionBoxAtom)
  const selectorRef = useRef(selector)
  const equalityRef = useRef((equality ?? defaultEquality) as Equality<T>)
  selectorRef.current = selector
  equalityRef.current = (equality ?? defaultEquality) as Equality<T>
  const next = selectorRef.current(snapshot)
  const selectedRef = useRef(next)
  if (!equalityRef.current(selectedRef.current, next)) {
    selectedRef.current = next
  }
  return selectedRef.current
}
