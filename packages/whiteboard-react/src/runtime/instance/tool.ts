import type { createStore } from 'jotai/vanilla'
import { toolAtom, type EditorTool } from './toolState'

type ToolDomain = {
  commands: {
    set: (tool: EditorTool) => void
  }
}

type ToolStore = ReturnType<typeof createStore>

const readTool = (uiStore: ToolStore): EditorTool =>
  uiStore.get(toolAtom)

const setTool = (
  uiStore: ToolStore,
  nextTool: EditorTool
): boolean => {
  if (readTool(uiStore) === nextTool) return false
  uiStore.set(toolAtom, nextTool)
  return true
}

export const createToolDomain = ({
  uiStore
}: {
  uiStore: ToolStore
}): ToolDomain => ({
  commands: {
    set: (nextTool) => {
      setTool(uiStore, nextTool)
    }
  }
})
