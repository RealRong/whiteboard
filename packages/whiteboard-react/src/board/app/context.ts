import { createContext, useContext } from 'react'
import type { ResolvedConfig } from '../../types/common/config'
import { useStoreValue } from '../../shared/hooks/useStoreValue'
import type { BoardController } from './controller'

type BoardContextValue = {
  controller: BoardController
  resolvedConfig: ResolvedConfig
}

type EditTarget = ReturnType<BoardController['runtime']['state']['edit']['get']>
type Tool = ReturnType<BoardController['runtime']['state']['tool']['get']>
type InteractionState = ReturnType<BoardController['runtime']['interaction']['state']['get']>

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

export const useBoardRuntime = (): BoardController['runtime'] => useBoardController().runtime

export const useHostRuntime = (): BoardController['host'] => useBoardController().host

export const useNodeRegistry = (): BoardController['registry'] => useBoardController().registry

export const useInteractionController = (): BoardController['runtime']['interaction'] =>
  useBoardRuntime().interaction

export const useEdit = (): EditTarget => {
  const runtime = useBoardRuntime()
  return useStoreValue(runtime.state.edit)
}

export const useTool = (): Tool => {
  const runtime = useBoardRuntime()
  return useStoreValue(runtime.state.tool)
}

export const useInteraction = (): InteractionState => {
  const runtime = useBoardRuntime()
  return useStoreValue(runtime.interaction.state)
}
