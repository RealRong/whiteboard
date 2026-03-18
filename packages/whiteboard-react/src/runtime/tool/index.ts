export type InsertPresetKey = string
export type DrawPresetKey = string

export type SelectTool = {
  type: 'select'
}

export type HandTool = {
  type: 'hand'
}

export type ConnectorTool = {
  type: 'connector'
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
  | ConnectorTool
  | InsertTool
  | DrawTool

export const SelectTool: SelectTool = {
  type: 'select'
}

export const HandTool: HandTool = {
  type: 'hand'
}

export const ConnectorTool: ConnectorTool = {
  type: 'connector'
}

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

  if (value === 'connector' || value === 'edge') {
    return ConnectorTool
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
    case 'connector':
      return ConnectorTool
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
