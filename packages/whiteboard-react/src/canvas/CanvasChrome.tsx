import { useEffect, useState, type RefObject } from 'react'
import type { ShortcutOverrides } from '../types/common/shortcut'
import { ContextMenu } from './ContextMenu'
import { NodeToolbar } from './NodeToolbar'
import { SelectionBox } from './SelectionBox'
import { LeftToolbar } from './toolbar/LeftToolbar'
import { useCanvasKeyboard } from './useCanvasKeyboard'

type CanvasSurface = {
  width: number
  height: number
}

const EmptySurface: CanvasSurface = {
  width: 0,
  height: 0
}

const readSurfaceSize = (
  element: HTMLDivElement | null
): CanvasSurface => ({
  width: element?.clientWidth ?? 0,
  height: element?.clientHeight ?? 0
})

const useCanvasSurface = (
  containerRef: RefObject<HTMLDivElement | null>
) => {
  const [surface, setSurface] = useState<CanvasSurface>(EmptySurface)

  useEffect(() => {
    const element = containerRef.current

    const updateSurface = () => {
      const nextSurface = readSurfaceSize(element)
      setSurface((current) => (
        current.width === nextSurface.width
        && current.height === nextSurface.height
          ? current
          : nextSurface
      ))
    }

    updateSurface()

    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      updateSurface()
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [containerRef])

  return surface
}

export const CanvasChrome = ({
  containerRef,
  shortcuts
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}) => {
  const surface = useCanvasSurface(containerRef)

  useCanvasKeyboard({
    containerRef,
    shortcuts
  })

  return (
    <>
      <LeftToolbar surface={surface} />
      <SelectionBox containerRef={containerRef} />
      <NodeToolbar
        containerRef={containerRef}
        surface={surface}
      />
      <ContextMenu
        containerRef={containerRef}
        surface={surface}
      />
    </>
  )
}
