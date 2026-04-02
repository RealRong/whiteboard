import { useEffect, useMemo, type RefObject } from 'react'
import { createRafTask } from '@whiteboard/engine'
import { useBoardController, useEditor, useResolvedConfig } from '../board/context'
import {
  createShortcutMap,
  detectShortcutPlatform,
  readShortcut,
  resolveShortcutBindings
} from '../runtime/host/shortcut'
import {
  isEditableTarget,
  isInputIgnoredTarget,
  isKeyboardIgnoredTarget
} from '../runtime/host/domTargets'
import {
  resolveKeyboardInput,
  resolvePointerInput,
  resolveWheelInput
} from '../runtime/host/input'
import { useClipboardActions } from '../runtime/host/useClipboardActions'
import {
  DefaultShortcutBindings,
  runShortcut
} from '../canvas/shortcut'

const isTextInputElement = (
  target: EventTarget | null
) => {
  if (!(target instanceof Element)) {
    return false
  }
  if (target.closest('textarea,select,[contenteditable]:not([contenteditable="false"])')) {
    return true
  }
  if (!(target instanceof HTMLInputElement)) {
    return false
  }

  const type = (target.type || 'text').toLowerCase()
  return (
    type === 'text'
    || type === 'search'
    || type === 'email'
    || type === 'url'
    || type === 'tel'
    || type === 'password'
    || type === 'number'
    || type === 'date'
    || type === 'datetime-local'
    || type === 'month'
    || type === 'time'
    || type === 'week'
  )
}

const readContainerRect = (
  element: HTMLDivElement
) => {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
}

export const SurfaceBindings = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const controller = useBoardController()
  const editor = useEditor()
  const resolvedConfig = useResolvedConfig()
  const clipboard = useClipboardActions()
  const bindings = useMemo(
    () => resolveShortcutBindings(DefaultShortcutBindings, resolvedConfig.shortcuts),
    [resolvedConfig.shortcuts]
  )
  const shortcutMap = useMemo(
    () => createShortcutMap(bindings, detectShortcutPlatform()),
    [bindings]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const {
      host,
      interaction
    } = controller
    let pendingWheelInput: ReturnType<typeof resolveWheelInput> | null = null
    let releasePointerSession: (() => void) | null = null
    let releaseSelectionLock: (() => void) | null = null

    const refreshContainerRect = () => {
      editor.commands.viewport.setRect(readContainerRect(container))
    }

    const stopBrowserEvent = (event: Event) => {
      if ('cancelable' in event && event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const clearPointerSession = () => {
      releasePointerSession?.()
      releasePointerSession = null
      releaseSelectionLock?.()
      releaseSelectionLock = null
    }

    const clearWheelFrame = () => {
      pendingWheelInput = null
      wheelTask.cancel()
    }

    const flushWheel = () => {
      const input = pendingWheelInput
      if (!input) {
        return
      }

      pendingWheelInput = null
      if (!resolvedConfig.viewport.enableWheel) {
        return
      }

      refreshContainerRect()
      interaction.dispatch.wheel(input)
    }

    const wheelTask = createRafTask(flushWheel)

    const scheduleWheel = (input: ReturnType<typeof resolveWheelInput>) => {
      if (pendingWheelInput) {
        pendingWheelInput.deltaX += input.deltaX
        pendingWheelInput.deltaY += input.deltaY
        pendingWheelInput.client = input.client
        pendingWheelInput.screen = input.screen
        pendingWheelInput.world = input.world
        pendingWheelInput.modifiers.alt = pendingWheelInput.modifiers.alt || input.modifiers.alt
        pendingWheelInput.modifiers.shift = pendingWheelInput.modifiers.shift || input.modifiers.shift
        pendingWheelInput.modifiers.ctrl = pendingWheelInput.modifiers.ctrl || input.modifiers.ctrl
        pendingWheelInput.modifiers.meta = pendingWheelInput.modifiers.meta || input.modifiers.meta
      } else {
        pendingWheelInput = {
          ...input,
          modifiers: {
            ...input.modifiers
          }
        }
      }

      wheelTask.schedule()
    }

    const focusContainer = () => {
      if (document.activeElement === container) {
        return
      }

      container.focus({
        preventScroll: true
      })
    }

    const shouldIgnoreClipboard = (target: EventTarget | null) =>
      isEditableTarget(target) || isInputIgnoredTarget(target)

    refreshContainerRect()

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
        refreshContainerRect()
      })

    observer?.observe(container)

    const onPointerDown = (event: PointerEvent) => {
      if (!isKeyboardIgnoredTarget(event.target)) {
        focusContainer()
      }

      if (event.defaultPrevented) {
        return
      }

      refreshContainerRect()
      const input = resolvePointerInput({
        phase: 'down',
        editor,
        pick: host.pick,
        container,
        event
      })
      host.pointer.set(input.world)

      const result = interaction.dispatch.pointerDown(input)
      if (result.handled) {
        stopBrowserEvent(event)
      }

      if (!result.continuePointer) {
        return
      }

      clearPointerSession()
      releaseSelectionLock = host.selectionLock.lock()
      releasePointerSession = host.pointerSession.start({
        container,
        pointerId: input.pointerId,
        move: (nextEvent) => {
          refreshContainerRect()
          const moveInput = resolvePointerInput({
            phase: 'move',
            editor,
            pick: host.pick,
            container,
            event: nextEvent
          })
          host.pointer.set(moveInput.world)
          if (interaction.dispatch.pointerMove(moveInput)) {
            stopBrowserEvent(nextEvent)
          }
        },
        up: (nextEvent) => {
          refreshContainerRect()
          const upInput = resolvePointerInput({
            phase: 'up',
            editor,
            pick: host.pick,
            container,
            event: nextEvent
          })
          host.pointer.set(upInput.world)
          if (interaction.dispatch.pointerUp(upInput)) {
            stopBrowserEvent(nextEvent)
          }
          clearPointerSession()
        },
        cancel: (nextEvent) => {
          host.pointer.clear()
          if (interaction.dispatch.pointerCancel({
            pointerId: nextEvent.pointerId
          })) {
            stopBrowserEvent(nextEvent)
          }
          clearPointerSession()
        }
      })
    }

    const onPointerMove = (event: PointerEvent) => {
      if (releasePointerSession) {
        return
      }

      refreshContainerRect()
      const input = resolvePointerInput({
        phase: 'move',
        editor,
        pick: host.pick,
        container,
        event
      })
      host.pointer.set(input.world)
      interaction.dispatch.pointerMove(input)
    }

    const onPointerLeave = () => {
      if (releasePointerSession) {
        return
      }

      host.pointer.clear()
      interaction.dispatch.pointerLeave()
    }

    const onWheel = (event: WheelEvent) => {
      if (!resolvedConfig.viewport.enableWheel) {
        return
      }
      if (isTextInputElement(event.target)) {
        return
      }

      refreshContainerRect()
      scheduleWheel(resolveWheelInput({
        editor,
        event
      }))
      stopBrowserEvent(event)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isKeyboardIgnoredTarget(event.target)) {
        return
      }

      const input = resolveKeyboardInput(event)

      if (interaction.dispatch.keyDown(input)) {
        stopBrowserEvent(event)
        return
      }

      if (event.repeat) {
        return
      }

      const action = readShortcut(input, shortcutMap)
      if (!action || !runShortcut(editor, action)) {
        return
      }

      stopBrowserEvent(event)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isKeyboardIgnoredTarget(event.target)) {
        if (event.code === 'Space' && interaction.state.get().space) {
          interaction.dispatch.keyUp(resolveKeyboardInput(event))
        }
        return
      }

      if (!interaction.dispatch.keyUp(resolveKeyboardInput(event))) {
        return
      }

      stopBrowserEvent(event)
    }

    const onWindowBlur = () => {
      clearWheelFrame()
      interaction.dispatch.blur()
    }

    const onCopy = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnoreClipboard(event.target)) {
        return
      }

      stopBrowserEvent(event)
      void clipboard.copy('selection', {
        event
      })
    }

    const onCut = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnoreClipboard(event.target)) {
        return
      }

      stopBrowserEvent(event)
      void clipboard.cut('selection', {
        event
      })
    }

    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnoreClipboard(event.target)) {
        return
      }

      stopBrowserEvent(event)
      void clipboard.paste({
        event
      })
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerleave', onPointerLeave)
    container.addEventListener('wheel', onWheel, { passive: false })
    container.addEventListener('keydown', onKeyDown)
    container.addEventListener('keyup', onKeyUp)
    container.addEventListener('copy', onCopy)
    container.addEventListener('cut', onCut)
    container.addEventListener('paste', onPaste)
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onWindowBlur)
    }

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerleave', onPointerLeave)
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('keydown', onKeyDown)
      container.removeEventListener('keyup', onKeyUp)
      container.removeEventListener('copy', onCopy)
      container.removeEventListener('cut', onCut)
      container.removeEventListener('paste', onPaste)
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onWindowBlur)
      }
      observer?.disconnect()
      clearWheelFrame()
      clearPointerSession()
      host.pointer.clear()
      interaction.dispatch.cancel()
    }
  }, [clipboard, containerRef, controller, editor, resolvedConfig.viewport.enableWheel, shortcutMap])

  return null
}
