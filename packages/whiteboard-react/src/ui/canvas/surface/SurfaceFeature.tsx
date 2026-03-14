import {
  useEffect,
  useState,
  type RefObject
} from 'react'
import { useSurfaceView } from './view'
import { NodeToolbarSurface } from './NodeToolbarSurface'
import { ContextMenuSurface } from './ContextMenuSurface'

type SurfaceSize = {
  width: number
  height: number
}

const EMPTY_SIZE: SurfaceSize = {
  width: 0,
  height: 0
}

const readSurfaceSize = (
  element: HTMLDivElement | null
): SurfaceSize => ({
  width: element?.clientWidth ?? 0,
  height: element?.clientHeight ?? 0
})

export const SurfaceFeature = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const [size, setSize] = useState<SurfaceSize>(EMPTY_SIZE)

  useEffect(() => {
    const element = containerRef.current
    const updateSize = () => {
      const nextSize = readSurfaceSize(element)
      setSize((current) => (
        current.width === nextSize.width
        && current.height === nextSize.height
          ? current
          : nextSize
      ))
    }

    updateSize()

    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      updateSize()
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [containerRef])

  const view = useSurfaceView({
    containerWidth: size.width,
    containerHeight: size.height
  })

  return (
    <>
      <NodeToolbarSurface
        containerRef={containerRef}
        view={view.toolbar}
      />
      <ContextMenuSurface view={view.contextMenu} />
    </>
  )
}
