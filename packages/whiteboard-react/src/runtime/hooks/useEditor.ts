import { createContext, useContext } from 'react'
import type { WhiteboardInstance } from '../editor'
import { useStoreValue } from './useStoreValue'

type EditTarget = ReturnType<WhiteboardInstance['state']['edit']['get']>
type Tool = ReturnType<WhiteboardInstance['state']['tool']['get']>
type FrameScope = ReturnType<WhiteboardInstance['state']['frame']['get']>
type InteractionState = ReturnType<WhiteboardInstance['state']['interaction']['get']>

const EditorContext = createContext<WhiteboardInstance | null>(null)

export const EditorProvider = EditorContext.Provider

export const useEditor = (): WhiteboardInstance => {
  const editor = useContext(EditorContext)
  if (!editor) {
    throw new Error('Whiteboard editor is not initialized')
  }
  return editor
}

export const useEdit = (): EditTarget => {
  const editor = useEditor()
  return useStoreValue(editor.state.edit)
}

export const useTool = (): Tool => {
  const editor = useEditor()
  return useStoreValue(editor.state.tool)
}

export const useFrameScope = (): FrameScope => {
  const editor = useEditor()
  return useStoreValue(editor.read.frame.scope)
}

export const useInteraction = (): InteractionState => {
  const editor = useEditor()
  return useStoreValue(editor.state.interaction)
}
