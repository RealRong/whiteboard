import {
  useCallback,
  useEffect,
  useRef,
  type RefObject
} from 'react'
import { useEditor } from '../runtime/hooks/useEditor'
import { useHostRuntime } from '../runtime/hooks/useHost'
import { resolvePointerInput } from '../runtime/host/input'

export const usePointer = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const editor = useEditor()
  const host = useHostRuntime()
  const releaseSessionRef = useRef<(() => void) | null>(null)
  const releaseSelectionRef = useRef<(() => void) | null>(null)

  const refreshContainerRect = useCallback((container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect()
    editor.viewport.setRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    })
  }, [editor])

  const clearSession = useCallback(() => {
    releaseSessionRef.current?.()
    releaseSessionRef.current = null
    releaseSelectionRef.current?.()
    releaseSelectionRef.current = null
  }, [])

  const stopBrowserEvent = (event: PointerEvent) => {
    if (event.cancelable) {
      event.preventDefault()
    }
    event.stopPropagation()
  }

  useEffect(() => () => {
    clearSession()
    editor.input.cancel()
  }, [clearSession, editor])

  const onPointerDown = useCallback((event: PointerEvent) => {
    if (event.defaultPrevented) {
      return false
    }

    const container = containerRef.current
    if (!container) {
      return false
    }

    refreshContainerRect(container)
    const input = resolvePointerInput({
      editor,
      pick: host.pick,
      container,
      event
    })
    host.pointer.set(input.world)
    const result = editor.input.pointerDown(input)
    if (result.handled) {
      stopBrowserEvent(event)
    }
    if (result.continuePointer) {
      clearSession()
      releaseSelectionRef.current = host.selectionLock.lock()
      releaseSessionRef.current = host.pointerSession.start({
        container,
        pointerId: input.pointerId,
        move: (nextEvent) => {
          refreshContainerRect(container)
          const moveInput = resolvePointerInput({
            editor,
            pick: host.pick,
            container,
            event: nextEvent
          })
          host.pointer.set(moveInput.world)
          if (editor.input.pointerMove(moveInput)) {
            stopBrowserEvent(nextEvent)
          }
        },
        up: (nextEvent) => {
          refreshContainerRect(container)
          const upInput = resolvePointerInput({
            editor,
            pick: host.pick,
            container,
            event: nextEvent
          })
          host.pointer.set(upInput.world)
          if (editor.input.pointerUp(upInput)) {
            stopBrowserEvent(nextEvent)
          }
          clearSession()
        },
        cancel: (nextEvent) => {
          host.pointer.clear()
          if (editor.input.pointerCancel({
            pointerId: nextEvent.pointerId
          })) {
            stopBrowserEvent(nextEvent)
          }
          clearSession()
        }
      })
    }

    return result.handled
  }, [clearSession, containerRef, editor, host, refreshContainerRect])

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (releaseSessionRef.current) {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    refreshContainerRect(container)
    const input = resolvePointerInput({
      editor,
      pick: host.pick,
      container,
      event
    })
    host.pointer.set(input.world)
    editor.input.pointerMove(input)
  }, [containerRef, editor, host, refreshContainerRect])

  const onPointerLeave = useCallback(() => {
    if (releaseSessionRef.current) {
      return
    }

    host.pointer.clear()
    editor.input.pointerLeave()
  }, [editor, host])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      onPointerDown(event)
    }
    const handlePointerMove = (event: PointerEvent) => {
      onPointerMove(event)
    }
    const handlePointerLeave = () => {
      onPointerLeave()
    }

    container.addEventListener('pointerdown', handlePointerDown, true)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [containerRef, onPointerDown, onPointerLeave, onPointerMove])
}
