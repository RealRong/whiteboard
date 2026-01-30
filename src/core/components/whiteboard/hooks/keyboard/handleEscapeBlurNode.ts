import { IWhiteboardInstance } from '~/typings'
import isHotkey from 'is-hotkey'
import { KEY } from '@/consts'

export default (e: KeyboardEvent, instance: IWhiteboardInstance) => {
  if (isHotkey(KEY.Escape, e)) {
    const selected = instance.selectOps?.getSelectedNodes()
    if (selected?.length === 1) {
      const first = selected[0]
      const nodeFuncs = instance.nodeOps?.getNodeFuncs(first.id)
      if (nodeFuncs?.getNodeState().focused) {
        nodeFuncs?.setNodeState(s => ({ ...s, focused: false }))
        instance.setFocused?.(true)
        return
      }
    }
    instance.selectOps?.deselectAll()
  }
}
