import type { Editor } from '../../types/editor'
import type { Tool } from '../../types/tool'
import {
  isSameTool
} from '../../tool/model'

export const createToolCommands = ({
  tool,
  edit,
  selection
}: {
  tool: {
    get: () => Tool
    set: (tool: Tool) => void
  }
  edit: {
    clear: () => void
  }
  selection: {
    clear: () => void
  }
}): Editor['commands']['tool'] => {
  const setTool = (nextTool: Tool) => {
    if (nextTool.type === 'draw') {
      edit.clear()
      selection.clear()
    }
    if (isSameTool(tool.get(), nextTool)) {
      return
    }
    tool.set(nextTool)
  }

  return {
    set: setTool
  }
}
