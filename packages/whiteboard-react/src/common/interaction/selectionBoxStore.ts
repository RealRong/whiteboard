import { useRef } from 'react'
import { atom, useAtomValue } from 'jotai'
import { createStore } from 'jotai/vanilla'
import type { Rect } from '@whiteboard/core/types'

type SelectionBoxSnapshot = {
  rect?: Rect
}

type Equality<T> = (left: T, right: T) => boolean

const defaultEquality: Equality<unknown> = Object.is
const EMPTY_SNAPSHOT: SelectionBoxSnapshot = {}

const selectionBoxAtom = atom<SelectionBoxSnapshot>(EMPTY_SNAPSHOT)
const selectionBoxAtomStore = createStore()

const setSnapshot = (next: SelectionBoxSnapshot) => {
  const snapshot = selectionBoxAtomStore.get(selectionBoxAtom)
  if (snapshot.rect === next.rect) return
  selectionBoxAtomStore.set(selectionBoxAtom, next)
}

export const selectionBoxStore = {
  subscribe: (listener: () => void) =>
    selectionBoxAtomStore.sub(selectionBoxAtom, listener),
  getSnapshot: () => selectionBoxAtomStore.get(selectionBoxAtom),
  setRect: (rect: Rect) => {
    setSnapshot({ rect })
  },
  clear: () => {
    const snapshot = selectionBoxAtomStore.get(selectionBoxAtom)
    if (!snapshot.rect) return
    setSnapshot(EMPTY_SNAPSHOT)
  }
}

export const useSelectionBoxSelector = <T,>(
  selector: (snapshot: SelectionBoxSnapshot) => T,
  equality?: Equality<T>
) => {
  const snapshot = useAtomValue(selectionBoxAtom, {
    store: selectionBoxAtomStore
  })
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
