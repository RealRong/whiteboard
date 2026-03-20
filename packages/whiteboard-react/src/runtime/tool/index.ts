import type { EdgeType } from '@whiteboard/core/types'

export type EdgePresetKey =
  | 'edge.straight'
  | 'edge.elbow'
  | 'edge.curve'

export type InsertPresetKey = string
export type DrawPresetKey = string

export type SelectTool = {
  type: 'select'
}

export type HandTool = {
  type: 'hand'
}

export type EdgeTool = {
  type: 'edge'
  preset: EdgePresetKey
}

export type InsertTool = {
  type: 'insert'
  preset: InsertPresetKey
}

export type DrawTool = {
  type: 'draw'
  preset: DrawPresetKey
}

export type Tool =
  | SelectTool
  | HandTool
  | EdgeTool
  | InsertTool
  | DrawTool

const EDGE_PRESET_TO_TYPE = {
  'edge.straight': 'linear',
  'edge.elbow': 'step',
  'edge.curve': 'curve'
} as const satisfies Record<EdgePresetKey, EdgeType>

export const DEFAULT_EDGE_PRESET_KEY: EdgePresetKey = 'edge.straight'

export const SelectTool: SelectTool = {
  type: 'select'
}

export const HandTool: HandTool = {
  type: 'hand'
}

export const createEdgeTool = (
  preset: EdgePresetKey = DEFAULT_EDGE_PRESET_KEY
): EdgeTool => ({
  type: 'edge',
  preset
})

const isEdgePresetKey = (
  value: string
): value is EdgePresetKey => value in EDGE_PRESET_TO_TYPE

export const readEdgeType = (
  preset: EdgePresetKey
): EdgeType => EDGE_PRESET_TO_TYPE[preset]

export const matchTool = (
  tool: Tool,
  type: Tool['type'],
  preset?: string
) => (
  tool.type === type
  && (
    preset === undefined
    || ('preset' in tool && tool.preset === preset)
  )
)

export const isSameTool = (
  left: Tool,
  right: Tool
) => {
  if (left.type !== right.type) {
    return false
  }

  switch (left.type) {
    case 'edge':
      return right.type === 'edge' && left.preset === right.preset
    case 'insert':
      return right.type === 'insert' && left.preset === right.preset
    case 'draw':
      return right.type === 'draw' && left.preset === right.preset
    default:
      return true
  }
}

export const normalizeTool = (
  value: unknown
): Tool => {
  if (value === 'hand') {
    return HandTool
  }

  if (value === 'edge') {
    return createEdgeTool()
  }

  if (value === 'select') {
    return SelectTool
  }

  if (!value || typeof value !== 'object') {
    return SelectTool
  }

  const tool = value as {
    type?: unknown
    preset?: unknown
  }

  switch (tool.type) {
    case 'hand':
      return HandTool
    case 'edge':
      return createEdgeTool(
        typeof tool.preset === 'string' && isEdgePresetKey(tool.preset)
          ? tool.preset
          : DEFAULT_EDGE_PRESET_KEY
      )
    case 'insert':
      return {
        type: 'insert',
        preset:
          typeof tool.preset === 'string' && tool.preset.trim()
            ? tool.preset
            : 'text'
      }
    case 'draw':
      return {
        type: 'draw',
        preset:
          typeof tool.preset === 'string' && tool.preset.trim()
            ? tool.preset
            : 'free'
      }
    case 'select':
    default:
      return SelectTool
  }
}
