import { useEffect, useRef, useState } from 'react'
import type { Instance } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Equality<T> = (left: T, right: T) => boolean

type UseWhiteboardViewOptions<T> = {
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is
type ViewGlobal = Instance['view']['global']

const useViewValue = <T,>(
  readValue: () => T,
  watchValue: (listener: () => void) => () => void,
  options?: UseWhiteboardViewOptions<T>
) => {
  const instance = useInstance()
  const equalityRef = useRef((options?.equality ?? defaultEquality) as Equality<T>)
  equalityRef.current = (options?.equality ?? defaultEquality) as Equality<T>

  const [value, setValue] = useState<T>(() => readValue())

  useEffect(() => {
    const update = () => {
      const next = readValue()
      setValue((prev) => (equalityRef.current(prev, next) ? prev : next))
    }

    update()
    return watchValue(update)
  }, [instance, readValue, watchValue])

  return value
}

export const useViewportTransformView = (
  options?: UseWhiteboardViewOptions<ReturnType<ViewGlobal['viewportTransform']>>
) => {
  const instance = useInstance()
  return useViewValue(
    instance.view.global.viewportTransform,
    instance.view.global.watchViewportTransform,
    options
  )
}

export const useShortcutContextView = (
  options?: UseWhiteboardViewOptions<ReturnType<ViewGlobal['shortcutContext']>>
) => {
  const instance = useInstance()
  return useViewValue(
    instance.view.global.shortcutContext,
    instance.view.global.watchShortcutContext,
    options
  )
}

export const useEdgePreviewView = (
  options?: UseWhiteboardViewOptions<ReturnType<ViewGlobal['edgePreview']>>
) => {
  const instance = useInstance()
  return useViewValue(
    instance.view.global.edgePreview,
    instance.view.global.watchEdgePreview,
    options
  )
}

export const useEdgeSelectedEndpointsView = (
  options?: UseWhiteboardViewOptions<ReturnType<ViewGlobal['edgeSelectedEndpoints']>>
) => {
  const instance = useInstance()
  return useViewValue(
    instance.view.global.edgeSelectedEndpoints,
    instance.view.global.watchEdgeSelectedEndpoints,
    options
  )
}

export const useEdgeSelectedRoutingView = (
  options?: UseWhiteboardViewOptions<ReturnType<ViewGlobal['edgeSelectedRouting']>>
) => {
  const instance = useInstance()
  return useViewValue(
    instance.view.global.edgeSelectedRouting,
    instance.view.global.watchEdgeSelectedRouting,
    options
  )
}

export const useMindmapDragView = (
  options?: UseWhiteboardViewOptions<ReturnType<ViewGlobal['mindmapDrag']>>
) => {
  const instance = useInstance()
  return useViewValue(
    instance.view.global.mindmapDrag,
    instance.view.global.watchMindmapDrag,
    options
  )
}
