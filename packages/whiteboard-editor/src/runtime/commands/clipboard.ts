import type { Editor } from '../editor/types'
import type { Point } from '@whiteboard/core/types'
import type {
  ClipboardPort,
  ClipboardRuntime
} from '../host/clipboard'
import type { EditorCommandHost } from './runtime'
import {
  copy,
  cut,
  paste
} from '../../features/selection/actions/clipboard'

export const createClipboardCommands = ({
  commandHost,
  runtime,
  port,
  readPointerWorld
}: {
  commandHost: EditorCommandHost
  runtime: ClipboardRuntime
  port: ClipboardPort
  readPointerWorld: () => Point | undefined
}): Editor['commands']['clipboard'] => ({
  copy: (target = 'selection', options) =>
    copy({
      editor: commandHost,
      runtime,
      port
    }, target, options?.event),
  cut: (target = 'selection', options) =>
    cut({
      editor: commandHost,
      runtime,
      port
    }, target, options?.event),
  paste: (options) =>
    paste({
      editor: commandHost,
      runtime,
      port
    }, options?.at
      ? options
      : {
          ...(options ?? {}),
          at: readPointerWorld()
        })
})
