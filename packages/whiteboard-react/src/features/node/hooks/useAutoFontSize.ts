import { useEffect, useMemo, useState, type RefObject } from 'react'
import type { Rect } from '@whiteboard/core/types'
import { useInternalInstance } from '../../../runtime/hooks'
import {
  TEXT_DEFAULT_FONT_SIZE,
  type TextVariant,
  createTextAutoFontTask,
  estimateTextAutoFont,
  scheduleTextAutoFont
} from '../text'

const isVisibleInViewport = ({
  left,
  top,
  right,
  bottom,
  viewportWidth,
  viewportHeight
}: {
  left: number
  top: number
  right: number
  bottom: number
  viewportWidth: number
  viewportHeight: number
}) => {
  const margin = 200
  return (
    right >= -margin
    && bottom >= -margin
    && left <= viewportWidth + margin
    && top <= viewportHeight + margin
  )
}

export const useAutoFontSize = ({
  text,
  placeholder,
  rect,
  variant,
  manualFontSize,
  sourceRef
}: {
  text: string
  placeholder: string
  rect: Rect
  variant: TextVariant
  manualFontSize?: number
  sourceRef: RefObject<HTMLElement | null>
}) => {
  const instance = useInternalInstance()
  const initialAutoFontSize = useMemo(
    () => estimateTextAutoFont({
      variant,
      rect
    }),
    [rect, variant]
  )
  const [resolved, setResolved] = useState<number>(
    manualFontSize ?? initialAutoFontSize
  )

  useEffect(() => {
    if (manualFontSize !== undefined) {
      setResolved(manualFontSize)
      return
    }

    if (variant === 'text') {
      setResolved(TEXT_DEFAULT_FONT_SIZE)
      return
    }

    const source = sourceRef.current
    if (!source) {
      setResolved(initialAutoFontSize)
      return
    }

    const task = createTextAutoFontTask({
      text,
      placeholder,
      source,
      variant
    })
    if (!task) {
      setResolved(initialAutoFontSize)
      return
    }

    if (!task.hasContent) {
      setResolved((current) => current === task.initial ? current : task.initial)
      return
    }

    const viewportSize = instance.internals.viewport.input.size()
    const topLeft = instance.viewport.worldToScreen({
      x: rect.x,
      y: rect.y
    })
    const bottomRight = instance.viewport.worldToScreen({
      x: rect.x + rect.width,
      y: rect.y + rect.height
    })
    const priority = isVisibleInViewport({
      left: topLeft.x,
      top: topLeft.y,
      right: bottomRight.x,
      bottom: bottomRight.y,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height
    })
      ? 0
      : 1

    setResolved((current) => current === task.initial ? current : task.initial)

    return scheduleTextAutoFont(task, priority, (fontSize) => {
      setResolved((current) => current === fontSize ? current : fontSize)
    })
  }, [
    initialAutoFontSize,
    instance,
    manualFontSize,
    placeholder,
    rect,
    sourceRef,
    text,
    variant
  ])

  return manualFontSize ?? resolved
}
