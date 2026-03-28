import type { Editor } from '../instance/types'
import type { Tool } from '../tool'
import {
  DEFAULT_DRAW_KIND,
  DEFAULT_EDGE_PRESET_KEY,
  HandTool,
  SelectTool,
  createDrawTool,
  createEdgeTool,
  isSameTool,
  normalizeTool
} from '../tool'

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
    const normalized = normalizeTool(nextTool)
    if (normalized.type === 'draw') {
      edit.clear()
      selection.clear()
    }
    if (isSameTool(tool.get(), normalized)) {
      return
    }
    tool.set(normalized)
  }

  return {
    set: setTool,
    select: () => {
      setTool(SelectTool)
    },
    hand: () => {
      setTool(HandTool)
    },
    edge: (preset = DEFAULT_EDGE_PRESET_KEY) => {
      setTool(createEdgeTool(preset))
    },
    insert: (preset) => {
      setTool({
        type: 'insert',
        preset
      })
    },
    draw: (kind = DEFAULT_DRAW_KIND) => {
      setTool(createDrawTool(kind))
    }
  }
}
