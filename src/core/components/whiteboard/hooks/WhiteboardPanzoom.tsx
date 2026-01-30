import { WhiteboardAtom } from '@/core/components/whiteboard/StateHooks'
import { memo, useEffect } from 'react'
import { useSelectWhiteboardState, useSetWhiteboardState } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import isHotkey from 'is-hotkey'
import { KEY } from '@/consts'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { useDebounceFn } from '@/hooks'
import { useSetAtom, useStore } from 'jotai'
import { WhiteboardTransformAtom } from '@/core/components/whiteboard/hooks/useWhiteboardTransform'
import { createPanZoom } from '@/core/components/whiteboard/panzoom'
import { assignProperties } from '@/utils'
import { flushSync } from 'react-dom'

const WhiteboardPanzoom = memo(({ onInitialized }: { onInitialized?: VoidFunction }) => {
  const store = useStore()
  const setWhiteboardTransform = useSetAtom(WhiteboardTransformAtom)
  const instance = useWhiteboardInstance()
  const debounceUpdateLastViewport = useDebounceFn(
    () => {
      const transform = instance.getTransform?.()
      transform &&
        instance.updateWhiteboard?.(w => {
          w.lastViewport = transform
        })
    },
    { wait: 200 }
  )
  // attach panzoom to container
  useEffect(() => {
    const container = instance.getContainerNode?.()
    if (container) {
      const panzoom = createPanZoom(container, {
        smoothScroll: false,
        maxZoom: 5,
        minZoom: 0.05,
        filterKey: () => {
          return true
        },
        onTouch: e => {
          e.preventDefault()
          return false
        },
        zoomDoubleClickSpeed: 1,
        beforeMouseDown: e => {
          const state = instance.getState()
          if (state.currentTool) {
            return true
          }
          if (state.pointerMode === 'pan') {
            return false
          }
          if (e.target?.closest('textarea,input,[contenteditable]')) return true
          if (e.button === 1) {
            return false
          }
          if (!(e.target as HTMLElement).hasAttribute('role')) return true
          if ((e.target as HTMLElement).hasAttribute('role')) {
            const role = (e.target as HTMLElement).getAttribute('role')
            if (role === 'modal' || role === 'data-container') return false
            return true
          }
          if (e.defaultPrevented) {
            return true
          } else {
            return false
          }
        },
        beforeWheel: e => {
          if (e.defaultPrevented) {
            return true
          }
          if (instance.getState().pointerMode === 'pan') {
            return false
          }
          if (e.ctrlKey || e.metaKey) {
            return false
          }
          const curr = panzoom.getTransform()
          if (e.deltaX !== 0 || e.deltaY !== 0) {
            panzoom.setTransform(
              {
                x: curr.x - e.deltaX,
                y: curr.y - e.deltaY,
                scale: curr.scale
              },
              500,
              true
            )

            return true
          }
          if (e.shiftKey) {
            panzoom.moveTo(curr.x - (e.deltaY || e.deltaX), curr.y)
          } else {
            panzoom.moveTo(curr.x, curr.y - e.deltaY)
          }
          return true
        },
        disableKeyboardInteraction: true
      })
      const lastViewport = store.get(WhiteboardAtom)?.lastViewport
      instance.panzoom = panzoom
      assignProperties(instance, {
        getTransform: () => {
          return panzoom.getTransform()
        }
      })
      if (lastViewport) {
        const container = instance.getContainerNode?.()
        if (container) {
          container.style.setProperty('--zoom-level', String(Math.sqrt(1 / lastViewport.scale)))
        }
        setWhiteboardTransform([lastViewport.x, lastViewport.y, lastViewport.scale])
        setWhiteboardState(s => ({ ...s, zoom: lastViewport.scale }))
        panzoom?.zoomTo(0, 0, lastViewport.scale)
        panzoom?.moveTo(lastViewport.x, lastViewport.y)
      } else {
        setWhiteboardState(s => ({ ...s, zoom: 1 }))
        setWhiteboardTransform([0, 0, 1])
      }
      panzoom.on('panstart', () => {
        console.log('panStart')
        setWhiteboardState(s => ({ ...s, isPanning: true }))
      })
      panzoom.on('panend', () => {
        console.log('panEnd')
        setWhiteboardState(s => ({ ...s, isPanning: false }))
      })
      panzoom.on('pan', e => {
        instance.emit?.({ type: 'panChange' })
        const t = panzoom.getTransform()
        flushSync(() => setWhiteboardTransform([t.x, t.y, t.scale]))
        debounceUpdateLastViewport.run()
      })
      panzoom.on('zoom', e => {
        const { scale, x, y } = panzoom.getTransform()
        flushSync(() => setWhiteboardTransform([x, y, scale]))
        const zoomMultipler = Math.sqrt(1 / scale)
        instance.emit?.({ type: 'zoomChange' })
        setWhiteboardState(s => (s.zoom === scale ? s : { ...s, zoom: scale }))
        debounceSetZoom.run(zoomMultipler)
        debounceUpdateLastViewport.run()
      })
      setTimeout(() => onInitialized?.(), 20)
      return () => {
        panzoom.dispose()
      }
    }
  }, [])

  const setWhiteboardState = useSetWhiteboardState()
  const { currentTool, isPanning, pointerMode } = useSelectWhiteboardState(s => ({
    currentTool: s.currentTool,
    isPanning: s.isPanning,
    pointerMode: s.pointerMode
  }))
  let containerCursor = 'default'
  if (currentTool) {
    containerCursor = 'crosshair'
  }
  if (isPanning) {
    containerCursor = 'grabbing'
  } else {
    if (pointerMode === 'pan') {
      containerCursor = 'grab'
    }
  }

  useEffect(() => {
    instance.getOutestContainerNode?.()?.style.setProperty('cursor', containerCursor)
  }, [containerCursor])

  const debounceSetZoom = useDebounceFn(
    (zoom: number) => {
      const container = instance.getContainerNode?.()
      if (container) {
        container.style.setProperty('--zoom-level', String(zoom))
      }
    },
    { wait: 50 }
  )

  useEffect(() => {
    const spacePressed = {
      current: false
    }
    const keyHandler = (e: KeyboardEvent) => {
      // press space to pan
      if (e.type === 'keydown' && isHotkey(KEY.Space, e)) {
        spacePressed.current = true
        setWhiteboardState(s => ({ ...s, pointerMode: 'pan' }))
      }
      if (e.type === 'keyup') {
        if (spacePressed.current) {
          setWhiteboardState(s => ({ ...s, pointerMode: s.toolbarPointerMode }))
        }
        spacePressed.current = false
      }
    }
    document.addEventListener('keydown', keyHandler)
    document.addEventListener('keyup', keyHandler)
    return () => {
      document.removeEventListener('keydown', keyHandler)
      document.removeEventListener('keyup', keyHandler)
    }
  }, [])
  return null
})

export default WhiteboardPanzoom
