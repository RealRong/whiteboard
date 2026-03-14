import type { EditorTool } from '../instance/toolState'
import { toolAtom } from '../instance/toolState'
import { useUiAtomValue } from './useUiAtom'

export const useTool = (): EditorTool => useUiAtomValue(toolAtom)
