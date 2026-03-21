import type { Node, NodeInput, Rect } from '@whiteboard/core/types'
import { createRafTask } from '../../runtime/utils/rafTask'

export type TextMeasureSize = {
  width: number
  height: number
}

export type TextWidthMode = 'auto' | 'fixed'
export type TextVariant = 'text' | 'sticky'

const TEXT_WIDTH_MODE_KEY = 'widthMode'
export const TEXT_DEFAULT_FONT_SIZE = 14
const TEXT_DEFAULT_LINE_HEIGHT_RATIO = 1.4
const EMPTY_LINE = '\u00A0'
const FIT_EPSILON = 0
const FIT_SAFE_VERTICAL_MARGIN = 2
const MAX_AUTO_FONT_TASKS_PER_FRAME = 8

type TextMeasureElements = {
  host: HTMLDivElement
  line: HTMLDivElement
  block: HTMLDivElement
  frame: HTMLDivElement
  content: HTMLDivElement
}

type TextAutoFontRange = {
  min: number
  max: number
}

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

type ContentBox = {
  width: number
  height: number
}

let textMeasureElements: TextMeasureElements | null = null
const textAutoFontCache = new Map<string, number>()
const textAutoFontQueue: TextAutoFontQueueTask[] = []

export const TEXT_START_SIZE = {
  width: 144,
  height: 24
} as const
export const STICKY_START_SIZE = {
  width: 200,
  height: 150
} as const
export const TEXT_PLACEHOLDER = 'Text'
export const STICKY_PLACEHOLDER = 'Sticky'
export const STICKY_DEFAULT_FILL = 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))'
export const STICKY_DEFAULT_TEXT_COLOR = 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
export const STICKY_DEFAULT_STROKE = 'hsl(var(--ui-text-primary, 40 2.1% 28%) / 0.12)'
export const STICKY_DEFAULT_STROKE_WIDTH = 1

export const TEXT_MIN_WIDTH = 24
export const TEXT_AUTO_MAX_WIDTH = 360

export const createTextNodeInput = (): Omit<NodeInput, 'position'> => ({
  type: 'text',
  size: { ...TEXT_START_SIZE },
  data: { text: '' }
})

export const createStickyNodeInput = (
  fill = STICKY_DEFAULT_FILL
): Omit<NodeInput, 'position'> => ({
  type: 'sticky',
  size: { ...STICKY_START_SIZE },
  data: {
    text: '',
    background: fill
  },
  style: {
    fill,
    color: STICKY_DEFAULT_TEXT_COLOR,
    stroke: STICKY_DEFAULT_STROKE,
    strokeWidth: STICKY_DEFAULT_STROKE_WIDTH
  }
})

export const isTextNode = (
  node: Pick<Node, 'type' | 'data'>
): node is Pick<Node, 'type' | 'data'> & { type: 'text' } => node.type === 'text'

export const readTextWidthMode = (
  node: Pick<Node, 'type' | 'data'>
): TextWidthMode => (
  isTextNode(node) && node.data?.[TEXT_WIDTH_MODE_KEY] === 'fixed'
    ? 'fixed'
    : 'auto'
)

export const setTextWidthMode = (
  node: Pick<Node, 'data'>,
  mode: TextWidthMode
) => ({
  ...(node.data ?? {}),
  [TEXT_WIDTH_MODE_KEY]: mode
})

export const isTextContentEmpty = (
  value: string
) => value.trim().length === 0

export const readEditableText = (
  element: HTMLDivElement
) => {
  const value = element.innerText.replace(/\r/g, '')
  return value === '\n' ? '' : value
}

export const focusEditableEnd = (
  element: HTMLDivElement
) => {
  element.focus()

  const selection = window.getSelection()
  if (!selection) {
    return
  }

  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

const readPx = (
  value: string,
  fallback: number
) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback
}

const readLineHeightPx = (
  lineHeight: string,
  sourceFontSize: number,
  fontSize: number
) => {
  if (lineHeight === 'normal') {
    return fontSize * TEXT_DEFAULT_LINE_HEIGHT_RATIO
  }

  const parsed = Number.parseFloat(lineHeight)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed * (sourceFontSize > 0 ? fontSize / sourceFontSize : 1)
    : fontSize * TEXT_DEFAULT_LINE_HEIGHT_RATIO
}

const normalizeMeasureContent = (
  value: string
) => {
  if (!value) {
    return EMPTY_LINE
  }

  return value.endsWith('\n')
    ? `${value}${EMPTY_LINE}`
    : value
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

const applyMeasureTypography = (
  element: HTMLDivElement,
  style: CSSStyleDeclaration,
  {
    fontSize,
    lineHeight
  }: {
    fontSize: number
    lineHeight: number
  }
) => {
  element.style.fontFamily = style.fontFamily
  element.style.fontSize = `${fontSize}px`
  element.style.fontStyle = style.fontStyle
  element.style.fontWeight = style.fontWeight
  element.style.lineHeight = `${lineHeight}px`
  element.style.letterSpacing = style.letterSpacing
  element.style.textTransform = style.textTransform
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

const ensureTextMeasureElements = (): TextMeasureElements | null => {
  if (typeof document === 'undefined') {
    return null
  }

  if (textMeasureElements) {
    return textMeasureElements
  }

  const host = document.createElement('div')
  const line = document.createElement('div')
  const block = document.createElement('div')
  const frame = document.createElement('div')
  const content = document.createElement('div')

  host.setAttribute('data-wb-text-measure', 'true')
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  host.style.top = '-100000px'
  host.style.visibility = 'hidden'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'
  host.style.contain = 'layout style paint'

  line.style.display = 'inline-block'
  line.style.width = 'auto'
  line.style.minWidth = '0'
  line.style.margin = '0'
  line.style.padding = '0'
  line.style.border = '0'
  line.style.boxSizing = 'border-box'
  line.style.whiteSpace = 'pre'
  line.style.wordBreak = 'normal'
  line.style.overflowWrap = 'normal'

  block.style.display = 'block'
  block.style.width = 'auto'
  block.style.minWidth = '0'
  block.style.margin = '0'
  block.style.padding = '0'
  block.style.border = '0'
  block.style.boxSizing = 'border-box'
  block.style.whiteSpace = 'pre-wrap'
  block.style.wordBreak = 'break-word'
  block.style.overflowWrap = 'break-word'

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
  host.appendChild(line)
  host.appendChild(block)
  host.appendChild(frame)
  document.body.appendChild(host)

  textMeasureElements = {
    host,
    line,
    block,
    frame,
    content
  }

  return textMeasureElements
}

const clampBoxSize = (
  size: number
) => Math.max(1, size)

const clampFontSize = (
  size: number,
  min: number,
  max: number
) => Math.max(min, Math.min(max, size))

const getDefaultFrameInset = (
  variant: TextVariant
) => ({
  padding: variant === 'sticky' ? 16 : 0,
  border: 1
})

const resolveApproximateContentBox = (
  variant: TextVariant,
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

const resolveAutoFontRange = (
  variant: TextVariant,
  box: ContentBox
): TextAutoFontRange => {
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

const estimateInitialAutoFontSize = (
  variant: TextVariant,
  box: ContentBox
) => {
  const { min, max } = resolveAutoFontRange(variant, box)
  const estimated = variant === 'sticky'
    ? Math.round(Math.min(box.height * 0.22, box.width * 0.18))
    : Math.round(box.height * 0.48)

  return clampFontSize(estimated, min, max)
}

const measureTextSizeFromSource = ({
  content,
  placeholder,
  source,
  minWidth,
  maxWidth,
  fontSize,
  caretWidth = 2
}: {
  content: string
  placeholder: string
  source: HTMLElement
  minWidth: number
  maxWidth: number
  fontSize?: number
  caretWidth?: number
}): TextMeasureSize | undefined => {
  const elements = ensureTextMeasureElements()
  if (!elements) {
    return undefined
  }

  const sourceStyle = window.getComputedStyle(source)
  const sourceFontSize = readPx(sourceStyle.fontSize, TEXT_DEFAULT_FONT_SIZE)
  const resolvedFontSize = fontSize ?? sourceFontSize
  const resolvedLineHeight = readLineHeightPx(
    sourceStyle.lineHeight,
    sourceFontSize,
    resolvedFontSize
  )
  const minHeight = Math.ceil(resolvedLineHeight)
  const resolvedMinWidth = Math.max(1, Math.ceil(minWidth))
  const resolvedMaxWidth = Math.max(resolvedMinWidth, Math.ceil(maxWidth))
  const measuredContent = content || placeholder

  applyMeasureTypography(elements.line, sourceStyle, {
    fontSize: resolvedFontSize,
    lineHeight: resolvedLineHeight
  })
  applyMeasureTypography(elements.block, sourceStyle, {
    fontSize: resolvedFontSize,
    lineHeight: resolvedLineHeight
  })

  const normalizedLineContent = normalizeMeasureContent(measuredContent)
  elements.line.textContent = normalizedLineContent
  elements.line.style.maxWidth = `${resolvedMaxWidth}px`

  const singleLineWidth = Math.ceil(elements.line.getBoundingClientRect().width + caretWidth)
  const width = Math.min(
    resolvedMaxWidth,
    Math.max(resolvedMinWidth, singleLineWidth)
  )

  elements.block.textContent = normalizeMeasureContent(measuredContent)
  elements.block.style.width = `${width}px`
  const measuredHeight = Math.ceil(elements.block.getBoundingClientRect().height)

  return {
    width,
    height: Math.max(minHeight, measuredHeight)
  }
}

const measureAutoFontSize = (
  input: TextAutoFontInput
) => {
  const elements = ensureTextMeasureElements()
  if (!elements) {
    return input.min
  }

  const {
    frame,
    content
  } = elements

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

export const measureTextNodeSize = ({
  node,
  content,
  placeholder,
  source,
  width,
  minWidth,
  maxWidth,
  fontSize
}: {
  node: Pick<Node, 'type' | 'data'>
  content: string
  placeholder: string
  source: HTMLElement
  width: number
  minWidth?: number
  maxWidth?: number
  fontSize?: number
}): TextMeasureSize | undefined => {
  const mode = readTextWidthMode(node)
  const resolvedWidth = Math.max(TEXT_MIN_WIDTH, Math.ceil(width))

  if (mode === 'fixed') {
    return measureTextSizeFromSource({
      content,
      placeholder,
      source,
      minWidth: resolvedWidth,
      maxWidth: resolvedWidth,
      fontSize
    })
  }

  const resolvedMinWidth = Math.max(
    TEXT_MIN_WIDTH,
    Math.ceil(minWidth ?? TEXT_MIN_WIDTH)
  )
  const resolvedMaxWidth = Math.max(
    resolvedWidth,
    TEXT_AUTO_MAX_WIDTH,
    Math.ceil(maxWidth ?? TEXT_AUTO_MAX_WIDTH)
  )

  return measureTextSizeFromSource({
    content,
    placeholder,
    source,
    minWidth: resolvedMinWidth,
    maxWidth: resolvedMaxWidth,
    fontSize
  })
}

export const estimateTextAutoFont = ({
  variant,
  rect
}: {
  variant: TextVariant
  rect: Rect
}) => {
  if (variant === 'text') {
    return TEXT_DEFAULT_FONT_SIZE
  }

  return estimateInitialAutoFontSize(
    variant,
    resolveApproximateContentBox(variant, rect)
  )
}

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
  const contentBox = resolveContentBox(metrics)
  const range = resolveAutoFontRange(variant, contentBox)
  const initial = clampFontSize(
    estimateInitialAutoFontSize(variant, contentBox),
    range.min,
    range.max
  )
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
