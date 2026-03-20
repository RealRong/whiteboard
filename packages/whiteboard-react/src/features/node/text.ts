import type { Node } from '@whiteboard/core/types'
import {
  measureTextSizeFromSource,
  type TextMeasureSize
} from './registry/default/shared'

export type TextWidthMode = 'auto' | 'fixed'

const TEXT_WIDTH_MODE_KEY = 'widthMode'

export const TEXT_START_SIZE = {
  width: 144,
  height: 24
} as const

export const TEXT_MIN_WIDTH = 24
export const TEXT_AUTO_MAX_WIDTH = 360

export const isTextNode = (
  node: Pick<Node, 'type'>
): node is Pick<Node, 'type'> & { type: 'text' } => node.type === 'text'

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

export const measureTextNodeSize = ({
  content,
  placeholder,
  source,
  mode,
  width,
  minWidth,
  maxWidth,
  fontSize
}: {
  content: string
  placeholder: string
  source: HTMLElement
  mode: TextWidthMode
  width: number
  minWidth?: number
  maxWidth?: number
  fontSize?: number
}): TextMeasureSize | undefined => {
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
