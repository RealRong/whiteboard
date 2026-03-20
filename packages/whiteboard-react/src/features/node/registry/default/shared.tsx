import type { Node, NodeSchema, SchemaField } from '@whiteboard/core/types'

export type TextMeasureSize = {
  width: number
  height: number
}

type TextMeasureElements = {
  host: HTMLDivElement
  line: HTMLDivElement
  block: HTMLDivElement
}

const DEFAULT_TEXT_FONT_SIZE = 14
const DEFAULT_TEXT_LINE_HEIGHT_RATIO = 1.4
const EMPTY_LINE = '\u00A0'

let textMeasureElements: TextMeasureElements | null = null

export const getDataString = (node: Node, key: string) => {
  const value = node.data && node.data[key]
  return typeof value === 'string' ? value : ''
}

export const getDataBool = (node: Node, key: string) => {
  const value = node.data && node.data[key]
  return typeof value === 'boolean' ? value : false
}

export const getStyleString = (node: Node, key: string) => {
  const value = node.style && node.style[key]
  return typeof value === 'string' ? value : undefined
}

export const getStyleNumber = (node: Node, key: string) => {
  const value = node.style && node.style[key]
  return typeof value === 'number' ? value : undefined
}

export const getNodeLabel = (node: Node, fallback: string) =>
  getDataString(node, 'title') || getDataString(node, 'text') || fallback

const createField = (
  scope: 'data' | 'style',
  path: string,
  label: string,
  type: SchemaField['type'],
  extra: Partial<SchemaField> = {}
): SchemaField => ({
  id: `${scope}.${path}`,
  label,
  type,
  scope,
  path,
  ...extra
})

export const dataField = (
  path: string,
  label: string,
  type: SchemaField['type'],
  extra?: Partial<SchemaField>
) => createField('data', path, label, type, extra)

export const styleField = (
  path: string,
  label: string,
  type: SchemaField['type'],
  extra?: Partial<SchemaField>
) => createField('style', path, label, type, extra)

export const createTextField = (path: 'title' | 'text') =>
  dataField(path, path === 'title' ? 'Title' : 'Text', path === 'title' ? 'string' : 'text')

export const createSchema = (
  type: string,
  label: string,
  fields: NodeSchema['fields']
): NodeSchema => ({
  type,
  label,
  fields
})

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
    return fontSize * DEFAULT_TEXT_LINE_HEIGHT_RATIO
  }

  const parsed = Number.parseFloat(lineHeight)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed * (sourceFontSize > 0 ? fontSize / sourceFontSize : 1)
    : fontSize * DEFAULT_TEXT_LINE_HEIGHT_RATIO
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

  host.appendChild(line)
  host.appendChild(block)
  document.body.appendChild(host)

  textMeasureElements = {
    host,
    line,
    block
  }

  return textMeasureElements
}

export const measureTextSizeFromSource = ({
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
  const sourceFontSize = readPx(sourceStyle.fontSize, DEFAULT_TEXT_FONT_SIZE)
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

  let widestLine = resolvedMinWidth

  measuredContent.split('\n').forEach((line) => {
    elements.line.textContent = line.length ? line : EMPTY_LINE
    widestLine = Math.max(
      widestLine,
      Math.ceil(elements.line.getBoundingClientRect().width + caretWidth)
    )
  })

  const width = Math.max(
    resolvedMinWidth,
    Math.min(widestLine, resolvedMaxWidth)
  )
  elements.block.style.width = `${width}px`
  elements.block.textContent = normalizeMeasureContent(measuredContent)

  return {
    width,
    height: Math.max(
      minHeight,
      Math.ceil(elements.block.getBoundingClientRect().height)
    )
  }
}
