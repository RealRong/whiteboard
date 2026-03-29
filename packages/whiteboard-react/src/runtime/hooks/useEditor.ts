import { createContext, useContext } from 'react'
import type {
  WhiteboardInstance,
  WhiteboardRuntime
} from '../../types/runtime'
import { useStoreValue } from './useStoreValue'

type EditTarget = ReturnType<WhiteboardInstance['state']['edit']['get']>
type Tool = ReturnType<WhiteboardInstance['state']['tool']['get']>
type FrameScope = ReturnType<WhiteboardInstance['state']['frame']['get']>
type InteractionState = ReturnType<WhiteboardInstance['interaction']['state']['get']>

const EditorContext = createContext<WhiteboardRuntime | null>(null)

export const EditorProvider = EditorContext.Provider

export const useEditorRuntime = (): WhiteboardRuntime => {
  const editor = useContext(EditorContext)
  if (!editor) {
    throw new Error('Whiteboard editor is not initialized')
  }
  return editor
}

export const useEditor = (): WhiteboardRuntime => useEditorRuntime()

export const useEdit = (): EditTarget => {
  const editor = useEditorRuntime()
  return useStoreValue(editor.state.edit)
}

export const useTool = (): Tool => {
  const editor = useEditorRuntime()
  return useStoreValue(editor.state.tool)
}

export const useFrameScope = (): FrameScope => {
  const editor = useEditorRuntime()
  return useStoreValue(editor.read.frame.scope)
}

export const useInteraction = (): InteractionState => {
  const editor = useEditorRuntime()
  return useStoreValue(editor.interaction.state)
}
