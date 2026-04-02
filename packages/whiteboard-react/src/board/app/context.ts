import { createContext, useContext } from 'react'
import type { ResolvedConfig } from '../types/common/config'
import { useStoreValue } from '../runtime/hooks/useStoreValue'
import type { BoardController } from './controller'

type BoardContextValue = {
  controller: BoardController
  resolvedConfig: ResolvedConfig
}

type EditTarget = ReturnType<BoardController['editor']['state']['edit']['get']>
type Tool = ReturnType<BoardController['editor']['state']['tool']['get']>
type InteractionState = ReturnType<BoardController['interaction']['state']['get']>

const BoardContext = createContext<BoardContextValue | null>(null)

export const BoardProvider = BoardContext.Provider

const useBoardContext = (): BoardContextValue => {
  const board = useContext(BoardContext)
  if (!board) {
    throw new Error('Whiteboard board controller is not initialized')
  }
  return board
}

export const useBoardController = (): BoardController => useBoardContext().controller

export const useResolvedConfig = (): ResolvedConfig => useBoardContext().resolvedConfig

export const useEditorRuntime = (): BoardController['editor'] => useBoardController().editor

export const useEditor = (): BoardController['editor'] => useEditorRuntime()

export const useHostRuntime = (): BoardController['host'] => useBoardController().host

export const useNodeRegistry = (): BoardController['registry'] => useBoardController().registry

export const useInteractionController = (): BoardController['interaction'] =>
  useBoardController().interaction

export const useEdit = (): EditTarget => {
  const editor = useEditorRuntime()
  return useStoreValue(editor.state.edit)
}

export const useTool = (): Tool => {
  const editor = useEditorRuntime()
  return useStoreValue(editor.state.tool)
}

export const useInteraction = (): InteractionState => {
  const interaction = useInteractionController()
  return useStoreValue(interaction.state)
}
