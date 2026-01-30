import { useSetWhiteboardState } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import { useEffect } from 'react'
import isHotkey from 'is-hotkey'
import { KEY } from '@/consts'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { assignProperties } from '@/utils'
import { IWhiteboardEvent } from '~/typings'

const useWhiteboardErase = () => {
  const setWhiteboardState = useSetWhiteboardState()
  const instance = useWhiteboardInstance()
  assignProperties(instance, {
    nodeOps: {
      ...instance.nodeOps,
      erase: id => {
        if (instance.getState().isErasing) {
          setWhiteboardState(s => ({ ...s, erasedNodes: new Set([...(s.erasedNodes || []), id]) }))
        }
      }
    }
  })
  const eventHandler = (e: IWhiteboardEvent) => {
    const state = instance.getState()
    if (e.type === 'pointerdown') {
      if (state.isPanning || state.pointerMode === 'pan') return
      if (state.currentTool === 'erase') {
        const event = e.e
        ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
        if (event.button === 0) {
          event.preventDefault()
          event.stopPropagation()
        }
        setWhiteboardState(s => ({ ...s, isErasing: true }))
      }
    }
    if (e.type === 'pointerup') {
      const erased = state.erasedNodes
      if (erased?.size) {
        instance.updateWhiteboard(w => {
          erased.forEach(id => {
            w.nodes?.delete(id)
            instance.values.NODE_TO_EDGE_MAP.get(id)?.forEach(i => w.edges?.delete(i))
          })
        }, true)
      }
      if (state.isErasing) {
        setWhiteboardState(s => ({ ...s, isErasing: false, erasedNodes: undefined }))
      }
    }
    if (e.type === 'keyup') {
      if (isHotkey(KEY.Escape, e.e)) {
        if (state.erasedNodes?.size) e.e.preventDefault()
        setWhiteboardState(s => ({ ...s, isErasing: false, erasedNodes: undefined }))
      }
    }
  }
  useEffect(() => {
    instance.addEventListener('pointerdown', eventHandler)
    instance.addEventListener('pointerup', eventHandler)
    instance.addEventListener('keyup', eventHandler)
    return () => {
      instance.removeEventListener('pointerdown', eventHandler)
      instance.removeEventListener('pointerup', eventHandler)
      instance.removeEventListener('keyup', eventHandler)
    }
  })
}

export default useWhiteboardErase
