import { useEffect, useRef, useState } from 'react'
import type { Instance, ViewState } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Equality<T> = (left: T, right: T) => boolean

type UseWhiteboardViewOptions<T> = {
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is

export const useViewSelector = <T,>(
  selector: (state: ViewState) => T,
  options?: UseWhiteboardViewOptions<T>
) => {
  const instance = useInstance()
  const selectorRef = useRef(selector)
  const equalityRef = useRef((options?.equality ?? defaultEquality) as Equality<T>)
  selectorRef.current = selector
  equalityRef.current = (options?.equality ?? defaultEquality) as Equality<T>

  const readSelected = () => selectorRef.current(instance.view.getState())

  const [selected, setSelected] = useState<T>(() => readSelected())

  useEffect(() => {
    const update = () => {
      const next = readSelected()
      setSelected((prev) => (equalityRef.current(prev, next) ? prev : next))
    }

    update()
    return instance.view.subscribe(update)
  }, [instance])

  return selected
}

export const useViewportTransformView = (
  options?: UseWhiteboardViewOptions<ViewState['viewport']['transform']>
) => useViewSelector((state) => state.viewport.transform, options)

export const useEdgePreviewView = (
  options?: UseWhiteboardViewOptions<ViewState['edges']['preview']>
) => useViewSelector((state) => state.edges.preview, options)

export const useEdgeSelectedEndpointsView = (
  options?: UseWhiteboardViewOptions<ViewState['edges']['selection']['endpoints']>
) => useViewSelector((state) => state.edges.selection.endpoints, options)

export const useMindmapDragView = (
  options?: UseWhiteboardViewOptions<ViewState['mindmap']['drag']>
) => useViewSelector((state) => state.mindmap.drag, options)

export type { UseWhiteboardViewOptions }
export type ViewStore = Instance['view']
