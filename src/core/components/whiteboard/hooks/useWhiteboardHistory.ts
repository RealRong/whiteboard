import { useStore } from 'jotai'
import { useEffect, useRef } from 'react'
import { WhiteboardAtom } from '@/core/components/whiteboard/StateHooks'
import isHotkey from 'is-hotkey'
import { applyPatches, Patch } from 'immer'
import { useDebounceFn, useMemoizedFn } from '@/hooks'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { assignProperties } from '@/utils'
import { IWhiteboardHistoryItem } from '~/typings'
import { mousePos } from '@/hooks/utils/useMousePositionRef'

const useWhiteboardHistory = () => {
  const store = useStore()
  const instance = useWhiteboardInstance()
  const updates = useRef<IWhiteboardHistoryItem[]>([])
  const history = useRef<{
    undos: IWhiteboardHistoryItem[]
    redos: IWhiteboardHistoryItem[]
  }>({
    undos: [],
    redos: []
  })
  const debounceHandleUpdates = useDebounceFn(
    () => {
      if (!updates.current.length) return
      const { undos } = history.current
      if (undos.length > 100) {
        undos.unshift()
      }
      const combinedUpdates: IWhiteboardHistoryItem = {
        patches: [],
        inversePatches: []
      }
      updates.current.forEach(u => {
        combinedUpdates.patches = [...combinedUpdates.patches, ...u.patches]
        combinedUpdates.inversePatches = [...u.inversePatches, ...combinedUpdates.inversePatches]
      })
      undos.push(combinedUpdates)
      updates.current = []
      history.current.redos = []
    },
    { wait: 50 }
  )
  const redo = () => {
    const { redos, undos } = history.current
    if (redos.length) {
      const lastRedo = redos[redos.length - 1]
      const currentWhiteboard = store.get(WhiteboardAtom)
      if (!currentWhiteboard) return
      instance.updateWhiteboard?.(w => {
        applyPatches(w, lastRedo.patches)
      })
      setTimeout(() => {
        if (instance.selectOps?.getSelectedNodes().length) {
          instance.selectOps?.resetSelectionBox()
        }
      })
      redos.pop()
      undos.push(lastRedo)
      instance.getOutestContainerNode?.()?.focus()
    }
  }
  const undo = () => {
    const { redos, undos } = history.current
    console.log(undos)
    if (undos.length) {
      const lastUndo = undos[undos.length - 1]
      const currentWhiteboard = store.get(WhiteboardAtom)
      if (currentWhiteboard) {
        instance.updateWhiteboard?.(w => {
          applyPatches(w, lastUndo.inversePatches)
        }, false)
        setTimeout(() => {
          if (instance.selectOps?.getSelectedNodes().length) {
            instance.selectOps?.resetSelectionBox()
          }
        })
        redos.push(lastUndo)
        undos.pop()
        instance.getOutestContainerNode?.()?.focus()
      }
    }
  }
  assignProperties(instance, {
    historyOps: {
      undo,
      redo,
      pushUpdates: item => {
        if (item.patches.length && item.inversePatches.length) {
          updates.current.push(item)
          history.current.redos = []
          debounceHandleUpdates.run()
        }
      }
    }
  })
  const keydownHandler = useMemoizedFn((e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('textarea, input, [contenteditable]')) return
    const element = document.elementFromPoint(mousePos.current[0], mousePos.current[1])
    if (!instance.getOutestContainerNode()?.contains(element)) return
    if (e.defaultPrevented) return
    if (isHotkey('mod+z', e)) {
      undo()
      e.preventDefault()
    }
    if (isHotkey('mod+y', e)) {
      redo()
      e.preventDefault()
    }
  })

  useEffect(() => {
    document.addEventListener('keydown', keydownHandler)
    return () => {
      document.removeEventListener('keydown', keydownHandler)
    }
  })
}

export default useWhiteboardHistory
