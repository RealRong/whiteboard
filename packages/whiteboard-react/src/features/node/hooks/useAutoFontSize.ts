import { useEffect, useMemo, useState, type RefObject } from 'react'
import type { Rect } from '@whiteboard/core/types'
import { createRafTask } from '../../../runtime/utils/rafTask'
import { useInternalInstance } from '../../../runtime/hooks'

type AutoFontVariant = 'text' | 'sticky'

type MeasureInput = {
  signature: string
  priority: number
  text: string
  variant: AutoFontVariant
  width: number
  height: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  borderTop: number
  borderRight: number
  borderBottom: number
  borderLeft: number
  fontFamily: string
  fontStyle: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  whiteSpace: string
  wordBreak: string
  overflowWrap: string
  min: number
  max: number
}

type QueueTask = {
  cancelled: boolean
  input: MeasureInput
  resolve: (fontSize: number) => void
}

type MeasureElements = {
  host: HTMLDivElement
  frame: HTMLDivElement
  text: HTMLDivElement
}

type ContentBox = {
  width: number
  height: number
}

const AUTO_FONT_CACHE = new Map<string, number>()
const MEASURE_QUEUE: QueueTask[] = []
const MAX_TASKS_PER_FRAME = 8
const FIT_EPSILON = 0
const FIT_SAFE_VERTICAL_MARGIN = 2

let measureElements: MeasureElements | null = null

const flushQueue = () => {
  let count = 0

  while (count < MAX_TASKS_PER_FRAME) {
    const task = MEASURE_QUEUE.shift()
    if (!task) {
      return
    }

    if (task.cancelled) {
      continue
    }

    const cached = AUTO_FONT_CACHE.get(task.input.signature)
    if (cached !== undefined) {
      task.resolve(cached)
      count += 1
      continue
    }

    const fontSize = measureAutoFontSize(task.input)
    AUTO_FONT_CACHE.set(task.input.signature, fontSize)
    task.resolve(fontSize)
    count += 1
  }

  if (MEASURE_QUEUE.some((task) => !task.cancelled)) {
    queueTask.schedule()
  }
}

const queueTask = createRafTask(flushQueue, {
  fallback: 'microtask'
})

const ensureMeasureElements = (): MeasureElements | null => {
  if (typeof document === 'undefined') {
    return null
  }

  if (measureElements) {
    return measureElements
  }

  const host = document.createElement('div')
  const frame = document.createElement('div')
  const text = document.createElement('div')

  host.setAttribute('data-wb-auto-font-measure', 'true')
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  host.style.top = '-100000px'
  host.style.visibility = 'hidden'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'
  host.style.contain = 'layout style paint'

  frame.style.position = 'relative'
  frame.style.display = 'block'
  frame.style.overflow = 'hidden'

  text.style.display = 'block'
  text.style.width = '100%'
  text.style.height = 'auto'
  text.style.minHeight = '100%'
  text.style.boxSizing = 'border-box'

  frame.appendChild(text)
  host.appendChild(frame)
  document.body.appendChild(host)

  measureElements = {
    host,
    frame,
    text
  }

  return measureElements
}

const clampFontSize = (
  size: number,
  min: number,
  max: number
) => Math.max(min, Math.min(max, size))

const clampBoxSize = (
  size: number
) => Math.max(1, size)

const getDefaultFrameInset = (
  variant: AutoFontVariant
) => ({
  padding: variant === 'sticky' ? 16 : 12,
  border: 1
})

const resolveApproximateContentBox = (
  variant: AutoFontVariant,
  rect: Rect
): ContentBox => {
  const inset = getDefaultFrameInset(variant)
  const horizontalInset = inset.padding * 2 + inset.border * 2
  const verticalInset = inset.padding * 2 + inset.border * 2

  return {
    width: clampBoxSize(rect.width - horizontalInset),
    height: clampBoxSize(rect.height - verticalInset - FIT_SAFE_VERTICAL_MARGIN)
  }
}

const resolveContentBox = ({
  width,
  height,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  borderTop,
  borderRight,
  borderBottom,
  borderLeft
}: {
  width: number
  height: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  borderTop: number
  borderRight: number
  borderBottom: number
  borderLeft: number
}): ContentBox => ({
  width: clampBoxSize(width - paddingLeft - paddingRight - borderLeft - borderRight),
  height: clampBoxSize(
    height - paddingTop - paddingBottom - borderTop - borderBottom - FIT_SAFE_VERTICAL_MARGIN
  )
})

const resolveAutoRange = (
  variant: AutoFontVariant,
  box: ContentBox
) => {
  const min = variant === 'sticky' ? 12 : 10
  const maxLimit = variant === 'sticky' ? 40 : 32
  const estimatedMax = variant === 'sticky'
    ? Math.floor(Math.min(box.height * 0.36, box.width * 0.22))
    : Math.floor(box.height * 0.68)

  return {
    min,
    max: clampFontSize(Math.max(min, estimatedMax), min, maxLimit)
  }
}

const estimateInitialFontSize = (
  variant: AutoFontVariant,
  box: ContentBox
) => {
  const { min, max } = resolveAutoRange(variant, box)
  const estimated = variant === 'sticky'
    ? Math.round(Math.min(box.height * 0.22, box.width * 0.18))
    : Math.round(box.height * 0.48)

  return clampFontSize(estimated, min, max)
}

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

const scheduleMeasure = (
  input: MeasureInput,
  resolve: (fontSize: number) => void
) => {
  const task: QueueTask = {
    cancelled: false,
    input,
    resolve
  }

  let insertAt = MEASURE_QUEUE.length
  while (
    insertAt > 0
    && MEASURE_QUEUE[insertAt - 1].input.priority > input.priority
  ) {
    insertAt -= 1
  }

  MEASURE_QUEUE.splice(insertAt, 0, task)
  queueTask.schedule()

  return () => {
    task.cancelled = true
  }
}

const fits = (frame: HTMLDivElement) => (
  frame.scrollWidth <= frame.clientWidth + FIT_EPSILON
  && frame.scrollHeight <= frame.clientHeight + FIT_EPSILON
)

const measureAutoFontSize = (input: MeasureInput) => {
  const elements = ensureMeasureElements()
  if (!elements) {
    return input.min
  }

  const {
    frame,
    text
  } = elements

  frame.style.boxSizing = 'border-box'
  frame.style.width = `${input.width}px`
  frame.style.height = `${clampBoxSize(input.height - FIT_SAFE_VERTICAL_MARGIN)}px`
  frame.style.paddingTop = `${input.paddingTop}px`
  frame.style.paddingRight = `${input.paddingRight}px`
  frame.style.paddingBottom = `${input.paddingBottom}px`
  frame.style.paddingLeft = `${input.paddingLeft}px`
  frame.style.borderTopWidth = `${input.borderTop}px`
  frame.style.borderRightWidth = `${input.borderRight}px`
  frame.style.borderBottomWidth = `${input.borderBottom}px`
  frame.style.borderLeftWidth = `${input.borderLeft}px`
  frame.style.borderStyle = 'solid'
  frame.style.borderColor = 'transparent'

  text.style.fontFamily = input.fontFamily
  text.style.fontStyle = input.fontStyle
  text.style.fontWeight = input.fontWeight
  text.style.lineHeight = input.lineHeight
  text.style.letterSpacing = input.letterSpacing
  text.style.whiteSpace = input.whiteSpace
  text.style.wordBreak = input.wordBreak
  text.style.overflowWrap = input.overflowWrap
  text.textContent = input.text

  let low = input.min
  let high = input.max
  let best = input.min

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    text.style.fontSize = `${mid}px`

    if (fits(frame)) {
      best = mid
      low = mid + 1
      continue
    }

    high = mid - 1
  }

  return best
}

const readNumber = (
  value: string
) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeLineHeight = (
  lineHeight: string,
  fontSize: string
) => {
  if (lineHeight === 'normal') {
    return lineHeight
  }

  const fontSizeValue = readNumber(fontSize)
  const lineHeightValue = readNumber(lineHeight)

  if (fontSizeValue <= 0 || lineHeightValue <= 0) {
    return lineHeight
  }

  const ratio = lineHeightValue / fontSizeValue
  return `${Math.round(ratio * 1000) / 1000}`
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
  variant: AutoFontVariant
  manualFontSize?: number
  sourceRef: RefObject<HTMLElement | null>
}) => {
  const instance = useInternalInstance()
  const approximateContentBox = useMemo(
    () => resolveApproximateContentBox(variant, rect),
    [rect, variant]
  )
  const initialAutoFontSize = useMemo(
    () => estimateInitialFontSize(variant, approximateContentBox),
    [approximateContentBox, variant]
  )
  const [resolved, setResolved] = useState<number>(
    manualFontSize ?? initialAutoFontSize
  )

  useEffect(() => {
    if (manualFontSize !== undefined) {
      setResolved(manualFontSize)
      return
    }

    const source = sourceRef.current
    const frame = source?.parentElement
    if (!source || !frame) {
      setResolved((current) => current ?? initialAutoFontSize)
      return
    }

    const frameRect = frame.getBoundingClientRect()
    if (frameRect.width <= 0 || frameRect.height <= 0) {
      setResolved(initialAutoFontSize)
      return
    }

    const sourceStyle = window.getComputedStyle(source)
    const frameStyle = window.getComputedStyle(frame)
    const content = text || placeholder
    const normalizedLineHeight = normalizeLineHeight(
      sourceStyle.lineHeight,
      sourceStyle.fontSize
    )
    const frameMetrics = {
      width: frameRect.width,
      height: frameRect.height,
      paddingTop: readNumber(frameStyle.paddingTop),
      paddingRight: readNumber(frameStyle.paddingRight),
      paddingBottom: readNumber(frameStyle.paddingBottom),
      paddingLeft: readNumber(frameStyle.paddingLeft),
      borderTop: readNumber(frameStyle.borderTopWidth),
      borderRight: readNumber(frameStyle.borderRightWidth),
      borderBottom: readNumber(frameStyle.borderBottomWidth),
      borderLeft: readNumber(frameStyle.borderLeftWidth)
    }
    const contentBox = resolveContentBox(frameMetrics)
    const range = resolveAutoRange(variant, contentBox)
    const liveInitialFontSize = estimateInitialFontSize(variant, contentBox)
    const hasContent = content.length > 0

    if (!hasContent) {
      setResolved((current) => {
        const next = clampFontSize(liveInitialFontSize, range.min, range.max)
        return current === next ? current : next
      })
      return
    }

    const signature = [
      variant,
      content,
      Math.round(frameRect.width * 100) / 100,
      Math.round(frameRect.height * 100) / 100,
      frameStyle.paddingTop,
      frameStyle.paddingRight,
      frameStyle.paddingBottom,
      frameStyle.paddingLeft,
      frameStyle.borderTopWidth,
      frameStyle.borderRightWidth,
      frameStyle.borderBottomWidth,
      frameStyle.borderLeftWidth,
      sourceStyle.fontFamily,
      sourceStyle.fontStyle,
      sourceStyle.fontWeight,
      normalizedLineHeight,
      sourceStyle.letterSpacing,
      sourceStyle.whiteSpace,
      sourceStyle.wordBreak,
      sourceStyle.overflowWrap,
      range.min,
      range.max
    ].join('|')

    const cached = AUTO_FONT_CACHE.get(signature)
    if (cached !== undefined) {
      setResolved(cached)
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

    setResolved((current) => {
      const next = clampFontSize(current, range.min, range.max)
      return current === next ? current : next
    })

    return scheduleMeasure({
      signature,
      priority,
      text: content,
      variant,
      width: frameMetrics.width,
      height: frameMetrics.height,
      paddingTop: frameMetrics.paddingTop,
      paddingRight: frameMetrics.paddingRight,
      paddingBottom: frameMetrics.paddingBottom,
      paddingLeft: frameMetrics.paddingLeft,
      borderTop: frameMetrics.borderTop,
      borderRight: frameMetrics.borderRight,
      borderBottom: frameMetrics.borderBottom,
      borderLeft: frameMetrics.borderLeft,
      fontFamily: sourceStyle.fontFamily,
      fontStyle: sourceStyle.fontStyle,
      fontWeight: sourceStyle.fontWeight,
      lineHeight: normalizedLineHeight,
      letterSpacing: sourceStyle.letterSpacing,
      whiteSpace: sourceStyle.whiteSpace,
      wordBreak: sourceStyle.wordBreak,
      overflowWrap: sourceStyle.overflowWrap,
      min: range.min,
      max: range.max
    }, (fontSize) => {
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
