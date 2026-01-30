import { useEffect } from 'react'
import isHotkey from 'is-hotkey'
import { KEY } from '@/consts'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { useSetWhiteboardState } from '@/core/components/whiteboard/hooks/useWhiteboardState'

const useWhiteboardShortcut = () => {
  const instance = useWhiteboardInstance()
  const setState = useSetWhiteboardState()
  useEffect(() => {
    const keydownHandler = (e: KeyboardEvent) => {
      if (isHotkey(KEY.Tab, e)) {
        const target = e.target as HTMLElement
        if (instance.getOutestContainerNode()?.contains(target)) {
          if (!target.closest?.('input,textarea,[contenteditable]')) {
            e.preventDefault()
          }
        }
      }
      if (isHotkey(KEY.Escape, e)) {
        setTimeout(() => {
          if (e.defaultPrevented) return
          const state = instance.getState()
          if (state.currentTool !== undefined) {
            if (state.currentTool === 'freehand') {
              if (!state.freeDrawing) {
                setState(s => ({ ...s, currentTool: undefined }))
              }
            }
            if (state.currentTool === 'erase') {
              if (!state.isErasing) {
                setState(s => ({ ...s, currentTool: undefined }))
              }
            }
          }
        })
      }
    }
    document.addEventListener('keyup', keydownHandler, true)
    return () => {
      document.removeEventListener('keyup', keydownHandler, true)
    }
  })
}

export default useWhiteboardShortcut
