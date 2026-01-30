/*
  Shortcuts:
  1. Enter: Create under
  2. Cmd+Enter: Create right
  3. Shift+Enter: Create above
 */
import isHotkey from 'is-hotkey'
import addSubNode from '@/core/components/whiteboard/node/mindmap/utils/addSubNode'
import { IWhiteboardInstance } from '~/typings'
import { isKeyboardEventCloseToInput } from '@/utils'

export default (e: KeyboardEvent, instance: IWhiteboardInstance) => {
  if (isHotkey('enter', e) || isHotkey('mod+enter', e) || isHotkey('shift+enter', e)) {
    if (isKeyboardEventCloseToInput(e)) return
    const currentSelected = instance.selectOps?.getSelectedNodes?.()
    if (currentSelected?.length === 1) {
      const node = currentSelected[0]
      if (node.type === 'mindmap' || node.rootId) {
        if (isHotkey('enter', e)) {
          addSubNode(node, 'bottom', instance, true)
        }
        if (isHotkey('mod+enter', e)) {
          addSubNode(node, 'right', instance, true)
        }
        if (isHotkey('shift+enter', e)) {
          addSubNode(node, 'top', instance, true)
        }
      }
    }
  }
}
