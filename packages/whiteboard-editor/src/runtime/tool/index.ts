import type { EdgeType } from '@whiteboard/core/types'
import type {
  DrawBrushKind,
  DrawKind,
  DrawTool,
  EdgePresetKey,
  EdgeTool,
  HandTool as HandToolType,
  InsertPresetKey,
  InsertTool,
  SelectTool as SelectToolType,
  Tool
} from '../../types/public/tool'

const EDGE_PRESET_TO_TYPE = {
  'edge.straight': 'linear',
  'edge.elbow': 'step',
  'edge.curve': 'curve'
} as const satisfies Record<EdgePresetKey, EdgeType>

export const DEFAULT_EDGE_PRESET_KEY: EdgePresetKey = 'edge.straight'
export const DEFAULT_DRAW_BRUSH_KIND: DrawBrushKind = 'pen'
export const DEFAULT_DRAW_KIND: DrawKind = DEFAULT_DRAW_BRUSH_KIND

export const SelectTool: SelectToolType = {
  type: 'select'
}

export const HandTool: HandToolType = {
  type: 'hand'
}

export const createEdgeTool = (
  preset: EdgePresetKey = DEFAULT_EDGE_PRESET_KEY
): EdgeTool => ({
  type: 'edge',
  preset
})

export const createDrawTool = (
  kind: DrawKind = DEFAULT_DRAW_KIND
): DrawTool => ({
  type: 'draw',
  kind
})

const isEdgePresetKey = (
  value: string
): value is EdgePresetKey => value in EDGE_PRESET_TO_TYPE

const isDrawBrushKindValue = (
  value: string
): value is DrawBrushKind => (
  value === 'pen'
  || value === 'highlighter'
)

export const isDrawBrushKind = (
  value: string
): value is DrawBrushKind => isDrawBrushKindValue(value)

export const isDrawKind = (
  value: string
): value is DrawKind => (
  value === 'eraser'
  || isDrawBrushKindValue(value)
)

export const readEdgeType = (
  preset: EdgePresetKey
): EdgeType => EDGE_PRESET_TO_TYPE[preset]

export const matchTool = (
  tool: Tool,
  type: Tool['type'],
  value?: string
) => (
  tool.type === type
  && (
    value === undefined
    || ('preset' in tool && tool.preset === value)
    || ('kind' in tool && tool.kind === value)
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
      return right.type === 'draw' && left.kind === right.kind
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
    kind?: unknown
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
      return createDrawTool(
        typeof tool.kind === 'string' && isDrawKind(tool.kind)
          ? tool.kind
          : typeof tool.preset === 'string' && isDrawKind(tool.preset)
            ? tool.preset
            : DEFAULT_DRAW_KIND
      )
    case 'select':
    default:
      return SelectTool
  }
}

export type {
  DrawBrushKind,
  DrawKind,
  DrawTool,
  EdgePresetKey,
  EdgeTool,
  InsertPresetKey,
  InsertTool,
  Tool
} from '../../types/public/tool'
