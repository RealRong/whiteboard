import {
  useEffect,
  useState,
  type RefObject
} from 'react'
import { NodeToolbarLayer } from './NodeToolbarLayer'
import { ContextMenuLayer } from './ContextMenuLayer'
import type { ContextMenuSession } from '../../context-menu/types'

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

export const CanvasChrome = ({
  containerRef,
  contextMenuSession,
  closeContextMenu
}: {
  containerRef: RefObject<HTMLDivElement | null>
  contextMenuSession: ContextMenuSession
  closeContextMenu: (mode: 'dismiss' | 'action') => void
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

  return (
    <>
      <NodeToolbarLayer
        containerRef={containerRef}
        containerWidth={size.width}
        containerHeight={size.height}
      />
      <ContextMenuLayer
        session={contextMenuSession}
        closeContextMenu={closeContextMenu}
        containerWidth={size.width}
        containerHeight={size.height}
      />
    </>
  )
}
