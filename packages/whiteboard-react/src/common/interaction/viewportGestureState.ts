import { useRef } from 'react'
import { atom, useAtomValue } from 'jotai'
import { isSameViewport } from '@whiteboard/core/geometry'
import type { Viewport } from '@whiteboard/core/types'
import type { Instance } from '@whiteboard/engine'

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

const copyViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const readSnapshot = (instance: Instance) => instance.runtime.store.get(viewportGestureAtom)
const writeSnapshot = (instance: Instance, next: ViewportGestureSnapshot) => {
  instance.runtime.store.set(viewportGestureAtom, next)
}

const setSnapshot = (instance: Instance, next: ViewportGestureSnapshot) => {
  const snapshot = readSnapshot(instance)
  const samePreview =
    snapshot.preview === next.preview
    || (
      snapshot.preview
      && next.preview
      && isSameViewport(snapshot.preview, next.preview)
    )
  if (samePreview && snapshot.spacePressed === next.spacePressed) return
  writeSnapshot(instance, next)
}

export const viewportGestureState = {
  subscribe: (instance: Instance, listener: () => void) =>
    instance.runtime.store.sub(viewportGestureAtom, listener),
  getSnapshot: (instance: Instance) => readSnapshot(instance),
  isSpacePressed: (instance: Instance) => readSnapshot(instance).spacePressed,
  setSpacePressed: (instance: Instance, pressed: boolean) => {
    const snapshot = readSnapshot(instance)
    if (snapshot.spacePressed === pressed) return
    setSnapshot(
      instance,
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
  setPreview: (instance: Instance, viewport: Viewport) => {
    const snapshot = readSnapshot(instance)
    setSnapshot(instance, {
      preview: copyViewport(viewport),
      spacePressed: snapshot.spacePressed
    })
  },
  clearPreview: (instance: Instance) => {
    const snapshot = readSnapshot(instance)
    if (!snapshot.preview) return
    setSnapshot(
      instance,
      snapshot.spacePressed
        ? {
          preview: undefined,
          spacePressed: true
        }
          : EMPTY_SNAPSHOT
    )
  },
  reset: (instance: Instance) => {
    const snapshot = readSnapshot(instance)
    if (snapshot === EMPTY_SNAPSHOT) return
    writeSnapshot(instance, EMPTY_SNAPSHOT)
  }
}

export const useViewportGestureSelector = <T,>(
  selector: (next: ViewportGestureSnapshot) => T,
  equality?: Equality<T>
) => {
  const snapshot = useAtomValue(viewportGestureAtom)
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
