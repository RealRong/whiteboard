import { toolAtom, type EditorTool } from '../instance/toolState'
import type { InternalWhiteboardInstance } from '../instance'

export const readToolView = (
  instance: Pick<InternalWhiteboardInstance, 'uiStore'>
): EditorTool => instance.uiStore.get(toolAtom)
