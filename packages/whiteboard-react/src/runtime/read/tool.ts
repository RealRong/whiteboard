import type { ReadStore } from '@whiteboard/core/runtime'
import type {
  EdgePresetKey,
  DrawPresetKey,
  InsertPresetKey,
  Tool
} from '../tool'
import { matchTool } from '../tool'

export type ToolRead = {
  get: () => Tool
  type: () => Tool['type']
  preset: () => EdgePresetKey | InsertPresetKey | DrawPresetKey | undefined
  is: (type: Tool['type'], preset?: string) => boolean
}

const readPreset = (
  tool: Tool
) => ('preset' in tool ? tool.preset : undefined)

export const createToolRead = ({
  tool
}: {
  tool: ReadStore<Tool>
}): ToolRead => ({
  get: () => tool.get(),
  type: () => tool.get().type,
  preset: () => readPreset(tool.get()),
  is: (type, preset) => matchTool(tool.get(), type, preset)
})
