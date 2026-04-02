import { useCallback } from 'react'
import type { Point } from '@whiteboard/core/types'
import type { EditorClipboardTarget } from '../../board'
import { useBoardRuntime, useHostRuntime } from '../../board'

const clonePoint = (
  point: Point
): Point => ({
  x: point.x,
  y: point.y
})

export const useClipboardActions = () => {
  const editor = useBoardRuntime()
  const host = useHostRuntime()

  const readDefaultOrigin = useCallback(() => {
    const pointer = host.pointer.get()
    if (pointer) {
      return clonePoint(pointer)
    }

    return clonePoint(editor.state.viewport.get().center)
  }, [editor, host])

  const copy = useCallback(async (
    target: EditorClipboardTarget = 'selection',
    options?: {
      event?: ClipboardEvent
    }
  ) => {
    const packet = editor.commands.clipboard.export(target)
    if (!packet) {
      return false
    }

    return host.clipboard.write(packet, options?.event)
  }, [editor, host])

  const cut = useCallback(async (
    target: EditorClipboardTarget = 'selection',
    options?: {
      event?: ClipboardEvent
    }
  ) => {
    const packet = editor.commands.clipboard.cut(target)
    if (!packet) {
      return false
    }

    return host.clipboard.write(packet, options?.event)
  }, [editor, host])

  const paste = useCallback(async (options?: {
    event?: ClipboardEvent
    origin?: Point
  }) => {
    const packet = await host.clipboard.read(options?.event)
    if (!packet) {
      return false
    }

    return editor.commands.clipboard.insert(packet, {
      origin: options?.origin ?? readDefaultOrigin()
    })
  }, [editor, host, readDefaultOrigin])

  return {
    copy,
    cut,
    paste
  }
}
