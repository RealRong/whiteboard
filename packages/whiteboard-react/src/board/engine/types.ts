import type {
  EditorCommands,
  EditorRead
} from '../../types/editor'
import type {
  ViewportRead,
  ViewportRuntime
} from '../viewport'

export type EditorViewportRuntime =
  ViewportRead & Pick<ViewportRuntime, 'input' | 'setRect' | 'setLimits'>

export type EditorCommandHost = {
  commands: Omit<EditorCommands, 'clipboard'>
  read: EditorRead
}
