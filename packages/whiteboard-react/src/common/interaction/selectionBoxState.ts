import { useRef } from 'react'
import { atom, useAtomValue } from 'jotai'
import type { Rect } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../instance/types'

type SelectionBoxSnapshot = {
  rect?: Rect
}

type Equality<T> = (left: T, right: T) => boolean

const defaultEquality: Equality<unknown> = Object.is
const EMPTY_SNAPSHOT: SelectionBoxSnapshot = {}

const selectionBoxAtom = atom<SelectionBoxSnapshot>(EMPTY_SNAPSHOT)

const readSnapshot = (instance: InternalWhiteboardInstance) => instance.uiStore.get(selectionBoxAtom)

const writeSnapshot = (instance: InternalWhiteboardInstance, next: SelectionBoxSnapshot) => {
  instance.uiStore.set(selectionBoxAtom, next)
}

const setSnapshot = (instance: InternalWhiteboardInstance, next: SelectionBoxSnapshot) => {
  const snapshot = readSnapshot(instance)
  if (snapshot.rect === next.rect) return
  writeSnapshot(instance, next)
}

export const selectionBoxState = {
  subscribe: (instance: InternalWhiteboardInstance, listener: () => void) =>
    instance.uiStore.sub(selectionBoxAtom, listener),
  getSnapshot: (instance: InternalWhiteboardInstance) => readSnapshot(instance),
  setRect: (instance: InternalWhiteboardInstance, rect: Rect) => {
    setSnapshot(instance, { rect })
  },
  clear: (instance: InternalWhiteboardInstance) => {
    const snapshot = readSnapshot(instance)
    if (!snapshot.rect) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  },
  reset: (instance: InternalWhiteboardInstance) => {
    const snapshot = readSnapshot(instance)
    if (snapshot === EMPTY_SNAPSHOT) return
    writeSnapshot(instance, EMPTY_SNAPSHOT)
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
