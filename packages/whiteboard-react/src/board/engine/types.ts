import type {
  EditorCommands,
  EditorRead
} from '../types'
import type {
  ViewportRead,
  ViewportRuntime
} from '../local/viewport'

export type EditorViewportRuntime =
  ViewportRead & Pick<ViewportRuntime, 'input' | 'setRect' | 'setLimits'>

export type EditorCommandHost = {
  commands: Omit<EditorCommands, 'clipboard'>
  read: EditorRead
}
