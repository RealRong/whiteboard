import type { Editor } from '../instance/types'
import type {
  ClipboardPort,
  ClipboardRuntime
} from '../host/clipboard'
import {
  copy,
  cut,
  paste
} from '../../features/selection/actions/clipboard'

type EditorCommandHost = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

export const createClipboardCommands = ({
  commandHost,
  runtime,
  port
}: {
  commandHost: EditorCommandHost
  runtime: ClipboardRuntime
  port: ClipboardPort
}): Editor['commands']['clipboard'] => ({
  copy: (target = 'selection', options) =>
    copy({
      instance: commandHost,
      runtime,
      port
    }, target, options?.event),
  cut: (target = 'selection', options) =>
    cut({
      instance: commandHost,
      runtime,
      port
    }, target, options?.event),
  paste: (options) =>
    paste({
      instance: commandHost,
      runtime,
      port
    }, options)
})
