import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

type Size = { width: number; height: number }

export const useViewportSize = (container: RefObject<HTMLElement>) => {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [container])

  return size
}
