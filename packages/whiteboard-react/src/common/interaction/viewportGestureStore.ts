import { useRef } from 'react'
import { atom, useAtomValue } from 'jotai'
import { createStore } from 'jotai/vanilla'
import { isSameViewport } from '@whiteboard/core/geometry'
import type { Viewport } from '@whiteboard/core/types'

type ViewportGestureSnapshot = {
  preview?: Viewport
  spacePressed: boolean
}

type Equality<T> = (left: T, right: T) => boolean

const defaultEquality: Equality<unknown> = Object.is
const EMPTY_SNAPSHOT: ViewportGestureSnapshot = {
  preview: undefined,
  spacePressed: false
}

const viewportGestureAtom = atom<ViewportGestureSnapshot>(EMPTY_SNAPSHOT)
const viewportGestureAtomStore = createStore()

const copyViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const readSnapshot = () => viewportGestureAtomStore.get(viewportGestureAtom)
const writeSnapshot = (next: ViewportGestureSnapshot) => {
  viewportGestureAtomStore.set(viewportGestureAtom, next)
}

const setSnapshot = (next: ViewportGestureSnapshot) => {
  const snapshot = readSnapshot()
  const samePreview =
    snapshot.preview === next.preview
    || (
      snapshot.preview
      && next.preview
      && isSameViewport(snapshot.preview, next.preview)
    )
  if (samePreview && snapshot.spacePressed === next.spacePressed) return
  writeSnapshot(next)
}

export const viewportGestureStore = {
  subscribe: (listener: () => void) =>
    viewportGestureAtomStore.sub(viewportGestureAtom, listener),
  getSnapshot: () => readSnapshot(),
  isSpacePressed: () => readSnapshot().spacePressed,
  setSpacePressed: (pressed: boolean) => {
    const snapshot = readSnapshot()
    if (snapshot.spacePressed === pressed) return
    setSnapshot(
      pressed
        ? {
          preview: snapshot.preview,
          spacePressed: true
        }
        : snapshot.preview
          ? {
            preview: snapshot.preview,
            spacePressed: false
          }
          : EMPTY_SNAPSHOT
    )
  },
  setPreview: (viewport: Viewport) => {
    const snapshot = readSnapshot()
    setSnapshot({
      preview: copyViewport(viewport),
      spacePressed: snapshot.spacePressed
    })
  },
  clearPreview: () => {
    const snapshot = readSnapshot()
    if (!snapshot.preview) return
    setSnapshot(
      snapshot.spacePressed
        ? {
          preview: undefined,
          spacePressed: true
        }
        : EMPTY_SNAPSHOT
    )
  },
  reset: () => {
    const snapshot = readSnapshot()
    if (snapshot === EMPTY_SNAPSHOT) return
    writeSnapshot(EMPTY_SNAPSHOT)
  }
}

export const useViewportGestureSelector = <T,>(
  selector: (next: ViewportGestureSnapshot) => T,
  equality?: Equality<T>
) => {
  const snapshot = useAtomValue(viewportGestureAtom, {
    store: viewportGestureAtomStore
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
