import { IWhiteboardInstance } from '~/typings'
import IsNode from '@/core/components/whiteboard/utils/isNode'

function isTextInputKey(key: string) {
  // 定义可以输入文字的按键范围
  let textInputKeys = [
    // 字母
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
    // 数字
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    // 其他符号
    ' ',
    '!',
    '@',
    '#',
    '$',
    '%',
    '^',
    '&',
    '*',
    '(',
    ')',
    '-',
    '=',
    '_',
    '+',
    '[',
    ']',
    '{',
    '}',
    '\\',
    '|',
    ';',
    ':',
    "'",
    '"',
    ',',
    '.',
    '/',
    '<',
    '>',
    '?',
    '`',
    '~'
  ]

  // 将按键转为小写进行比较
  return textInputKeys.includes(key.toLowerCase())
}
export default (e: KeyboardEvent, instance: IWhiteboardInstance) => {
  setTimeout(() => {
    console.log(e)
    if (!e.defaultPrevented) {
      if (!isTextInputKey(e.key)) return
      const selected = instance.selectOps?.getSelectedNodes()
      if (selected?.length === 1) {
        const first = selected[0]
        if (IsNode.isTextNode(first)) {
          const nodeFuncs = instance.nodeOps?.getNodeFuncs(first.id)
          const focusText = nodeFuncs?.focusText
          if (focusText) {
            focusText(e)
            nodeFuncs?.setNodeState(s => ({ ...s, focused: true }))
          }
        }
      }
    }
  })
}
