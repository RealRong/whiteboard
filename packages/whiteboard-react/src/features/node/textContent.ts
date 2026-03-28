import type { Node } from '@whiteboard/core/types'

export type TextWidthMode = 'auto' | 'fixed'

const TEXT_WIDTH_MODE_KEY = 'widthMode'

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
