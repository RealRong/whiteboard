import { useAtomValue } from 'jotai'
import type { EditorTool } from '../instance/toolState'
import { toolAtom } from '../instance/toolState'

export const useTool = (): EditorTool => useAtomValue(toolAtom)
