import {
  createValueStore,
  type ValueStore
} from '@whiteboard/core/runtime'

export type EditorTool = 'select' | 'edge'

export const createToolState = (
  initial: EditorTool = 'select'
): ValueStore<EditorTool> => createValueStore(initial)
