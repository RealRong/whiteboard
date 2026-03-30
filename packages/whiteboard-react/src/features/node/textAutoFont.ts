import {
  estimateTextAutoFont as estimateTextAutoFontValue,
  resolveTextAutoFont,
  resolveTextContentBox,
  TEXT_FIT_VERTICAL_MARGIN
} from '@whiteboard/core/node'
import type { TextContentBox, TextVariant } from '@whiteboard/core/node'
import type { Rect } from '@whiteboard/core/types'
import { createRafTask } from '@whiteboard/engine'

type TextAutoFontInput = {
  signature: string
  priority: number
  text: string
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
  textTransform: string
  whiteSpace: string
  wordBreak: string
  overflowWrap: string
  min: number
  max: number
}

type TextAutoFontTypography = Pick<
  TextAutoFontInput,
  | 'fontFamily'
  | 'fontStyle'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'textTransform'
  | 'whiteSpace'
  | 'wordBreak'
  | 'overflowWrap'
>

type TextMeasureElements = {
  host: HTMLDivElement
  frame: HTMLDivElement
  content: HTMLDivElement
}

type TextAutoFontQueueTask = {
  cancelled: boolean
  input: TextAutoFontInput
  resolve: (fontSize: number) => void
}

export type TextAutoFontTask = {
  initial: number
  hasContent: boolean
  input: Omit<TextAutoFontInput, 'priority'>
}

const TEXT_DEFAULT_LINE_HEIGHT_RATIO = 1.4
const FIT_EPSILON = 0
const MAX_AUTO_FONT_TASKS_PER_FRAME = 8

let textMeasureElements: TextMeasureElements | null = null
const textAutoFontCache = new Map<string, number>()
const textAutoFontQueue: TextAutoFontQueueTask[] = []

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

const applyAutoFontTypography = (
  element: HTMLDivElement,
  input: TextAutoFontTypography
) => {
  element.style.fontFamily = input.fontFamily
  element.style.fontStyle = input.fontStyle
  element.style.fontWeight = input.fontWeight
  element.style.lineHeight = input.lineHeight
  element.style.letterSpacing = input.letterSpacing
  element.style.textTransform = input.textTransform
  element.style.whiteSpace = input.whiteSpace
  element.style.wordBreak = input.wordBreak
  element.style.overflowWrap = input.overflowWrap
}

const ensureAutoFontElements = (): TextMeasureElements | null => {
  if (typeof document === 'undefined') {
    return null
  }

  if (textMeasureElements) {
    return textMeasureElements
  }

  const host = document.createElement('div')
  const frame = document.createElement('div')
  const content = document.createElement('div')

  host.setAttribute('data-wb-text-autofont-measure', 'true')
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  host.style.top = '-100000px'
  host.style.visibility = 'hidden'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'
  host.style.contain = 'layout style paint'

  frame.style.position = 'relative'
  frame.style.display = 'block'
  frame.style.margin = '0'
  frame.style.padding = '0'
  frame.style.border = '0'
  frame.style.boxSizing = 'border-box'
  frame.style.overflow = 'hidden'

  content.style.display = 'block'
  content.style.width = '100%'
  content.style.height = 'auto'
  content.style.minHeight = '100%'
  content.style.margin = '0'
  content.style.padding = '0'
  content.style.border = '0'
  content.style.boxSizing = 'border-box'

  frame.appendChild(content)
  host.appendChild(frame)
  document.body.appendChild(host)

  textMeasureElements = {
    host,
    frame,
    content
  }

  return textMeasureElements
}

const measureAutoFontSize = (
  input: TextAutoFontInput
) => {
  const elements = ensureAutoFontElements()
  if (!elements) {
    return input.min
  }

  const {
    frame,
    content
  } = elements

  frame.style.width = `${input.width}px`
  frame.style.height = `${Math.max(1, input.height - TEXT_FIT_VERTICAL_MARGIN)}px`
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

  applyAutoFontTypography(content, input)
  content.textContent = input.text

  let low = input.min
  let high = input.max
  let best = input.min

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    content.style.fontSize = `${mid}px`

    const fits = (
      frame.scrollWidth <= frame.clientWidth + FIT_EPSILON
      && frame.scrollHeight <= frame.clientHeight + FIT_EPSILON
    )

    if (fits) {
      best = mid
      low = mid + 1
      continue
    }

    high = mid - 1
  }

  return best
}

const flushAutoFontQueue = () => {
  let count = 0

  while (count < MAX_AUTO_FONT_TASKS_PER_FRAME) {
    const task = textAutoFontQueue.shift()
    if (!task) {
      return
    }

    if (task.cancelled) {
      continue
    }

    const cached = textAutoFontCache.get(task.input.signature)
    if (cached !== undefined) {
      task.resolve(cached)
      count += 1
      continue
    }

    const fontSize = measureAutoFontSize(task.input)
    textAutoFontCache.set(task.input.signature, fontSize)
    task.resolve(fontSize)
    count += 1
  }

  if (textAutoFontQueue.some((task) => !task.cancelled)) {
    textAutoFontQueueTask.schedule()
  }
}

const textAutoFontQueueTask = createRafTask(flushAutoFontQueue, {
  fallback: 'microtask'
})

export const estimateTextAutoFont = ({
  variant,
  rect
}: {
  variant: TextVariant
  rect: Rect
}) => estimateTextAutoFontValue(variant, rect)

export const createTextAutoFontTask = ({
  text,
  placeholder,
  source,
  variant
}: {
  text: string
  placeholder: string
  source: HTMLElement
  variant: TextVariant
}): TextAutoFontTask | undefined => {
  const frame = source.parentElement
  if (!(frame instanceof HTMLElement)) {
    return undefined
  }

  const frameRect = frame.getBoundingClientRect()
  if (frameRect.width <= 0 || frameRect.height <= 0) {
    return undefined
  }

  const sourceStyle = window.getComputedStyle(source)
  const frameStyle = window.getComputedStyle(frame)
  const content = text || placeholder
  const hasContent = text.length > 0
  const metrics = {
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
  const contentBox: TextContentBox = resolveTextContentBox(metrics)
  const range = resolveTextAutoFont(variant, contentBox)
  const initial = range.initial
  const normalizedLineHeight = normalizeLineHeight(
    sourceStyle.lineHeight,
    sourceStyle.fontSize
  )
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
    sourceStyle.textTransform,
    sourceStyle.whiteSpace,
    sourceStyle.wordBreak,
    sourceStyle.overflowWrap,
    range.min,
    range.max
  ].join('|')

  return {
    initial,
    hasContent,
    input: {
      signature,
      text: content,
      width: metrics.width,
      height: metrics.height,
      paddingTop: metrics.paddingTop,
      paddingRight: metrics.paddingRight,
      paddingBottom: metrics.paddingBottom,
      paddingLeft: metrics.paddingLeft,
      borderTop: metrics.borderTop,
      borderRight: metrics.borderRight,
      borderBottom: metrics.borderBottom,
      borderLeft: metrics.borderLeft,
      fontFamily: sourceStyle.fontFamily,
      fontStyle: sourceStyle.fontStyle,
      fontWeight: sourceStyle.fontWeight,
      lineHeight: normalizedLineHeight,
      letterSpacing: sourceStyle.letterSpacing,
      textTransform: sourceStyle.textTransform,
      whiteSpace: sourceStyle.whiteSpace,
      wordBreak: sourceStyle.wordBreak,
      overflowWrap: sourceStyle.overflowWrap,
      min: range.min,
      max: range.max
    }
  }
}

export const scheduleTextAutoFont = (
  task: TextAutoFontTask,
  priority: number,
  resolve: (fontSize: number) => void
) => {
  const cached = textAutoFontCache.get(task.input.signature)
  if (cached !== undefined) {
    resolve(cached)
    return () => {}
  }

  const queuedTask: TextAutoFontQueueTask = {
    cancelled: false,
    input: {
      ...task.input,
      priority
    },
    resolve
  }

  let insertAt = textAutoFontQueue.length
  while (
    insertAt > 0
    && textAutoFontQueue[insertAt - 1].input.priority > priority
  ) {
    insertAt -= 1
  }

  textAutoFontQueue.splice(insertAt, 0, queuedTask)
  textAutoFontQueueTask.schedule()

  return () => {
    queuedTask.cancelled = true
  }
}
