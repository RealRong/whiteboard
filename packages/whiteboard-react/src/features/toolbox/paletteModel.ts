import {
  DEFAULT_DRAW_BRUSH_KIND,
  DEFAULT_DRAW_KIND,
  DEFAULT_EDGE_PRESET_KEY,
  isDrawBrushKind,
  type DrawBrushKind,
  type DrawKind,
  type EdgePresetKey,
  type Tool
} from '../../runtime/tool'
import {
  readDrawSlot,
  readDrawStyle,
  type DrawBrush,
  type DrawSlot,
  type DrawState,
  type ResolvedDrawStyle
} from '../draw/state'
import type { ShapeKind } from '../node/shape'
import {
  DEFAULT_MINDMAP_PRESET_KEY,
  DEFAULT_SHAPE_PRESET_KEY,
  DEFAULT_STICKY_PRESET_KEY,
  readInsertPresetGroup,
  readShapePresetKind,
  readStickyInsertTone,
  type InsertPresetGroup,
  type StickyTone
} from './presets'

export type ToolPaletteMenuKey =
  | 'draw'
  | 'edge'
  | 'sticky'
  | 'shape'
  | 'mindmap'

export type ToolPaletteBrushState = {
  brushKind: DrawBrushKind
  brush: DrawBrush
  slot: DrawSlot
}

export type ToolPaletteView = {
  insertGroup?: InsertPresetGroup
  stickyPreset: string
  stickyTone?: StickyTone
  shapePreset: string
  shapeKind?: ShapeKind
  mindmapPreset: string
  edgePreset: EdgePresetKey
  drawKind: DrawKind
  drawBrush: ToolPaletteBrushState
  drawStyle: ResolvedDrawStyle
  drawButtonStyle?: ResolvedDrawStyle
}

export type ToolPaletteMenuPlacement = {
  left: number
  top: number
  width: number
}

const TOOLBAR_INSET = 16
const TOOLBAR_BUTTON_SIZE = 40
const MENU_OFFSET = 10

const MENU_WIDTH: Record<ToolPaletteMenuKey, number> = {
  draw: 360,
  edge: 240,
  sticky: 240,
  shape: 240,
  mindmap: 240
}

const MENU_APPROX_HEIGHT: Record<ToolPaletteMenuKey, number> = {
  draw: 324,
  edge: 164,
  sticky: 164,
  shape: 388,
  mindmap: 248
}

export const readToolPaletteBrushState = (
  state: DrawState,
  kind: DrawKind
): ToolPaletteBrushState => {
  const brushKind = isDrawBrushKind(kind)
    ? kind
    : DEFAULT_DRAW_BRUSH_KIND
  const brush = state[brushKind]

  return {
    brushKind,
    brush,
    slot: readDrawSlot(state, brushKind)
  }
}

export const readToolPaletteView = ({
  tool,
  drawState,
  lastDrawKind = DEFAULT_DRAW_KIND,
  lastEdgePreset = DEFAULT_EDGE_PRESET_KEY
}: {
  tool: Tool
  drawState: DrawState
  lastDrawKind?: DrawKind
  lastEdgePreset?: EdgePresetKey
}): ToolPaletteView => {
  const insertGroup = tool.type === 'insert'
    ? readInsertPresetGroup(tool.preset)
    : undefined
  const stickyPreset = tool.type === 'insert' && insertGroup === 'sticky'
    ? tool.preset
    : DEFAULT_STICKY_PRESET_KEY
  const shapePreset = tool.type === 'insert' && insertGroup === 'shape'
    ? tool.preset
    : DEFAULT_SHAPE_PRESET_KEY
  const mindmapPreset = tool.type === 'insert' && insertGroup === 'mindmap'
    ? tool.preset
    : DEFAULT_MINDMAP_PRESET_KEY
  const edgePreset = tool.type === 'edge'
    ? tool.preset
    : lastEdgePreset
  const drawKind = tool.type === 'draw'
    ? tool.kind
    : lastDrawKind
  const drawBrush = readToolPaletteBrushState(drawState, drawKind)
  const drawStyle = readDrawStyle(drawState, drawBrush.brushKind)

  return {
    insertGroup,
    stickyPreset,
    stickyTone: readStickyInsertTone(stickyPreset),
    shapePreset,
    shapeKind: readShapePresetKind(shapePreset),
    mindmapPreset,
    edgePreset,
    drawKind,
    drawBrush,
    drawStyle,
    drawButtonStyle: isDrawBrushKind(drawKind)
      ? drawStyle
      : undefined
  }
}

export const readToolPaletteMenuWidth = (
  key: ToolPaletteMenuKey,
  drawKind: DrawKind,
  drawPanelOpen: boolean
) => (
  key === 'draw' && (!drawPanelOpen || drawKind === 'eraser')
    ? 72
    : MENU_WIDTH[key]
)

export const readToolPaletteMenuHeight = (
  key: ToolPaletteMenuKey,
  drawKind: DrawKind,
  drawPanelOpen: boolean
) => {
  if (key !== 'draw') {
    return MENU_APPROX_HEIGHT[key]
  }

  if (drawKind === 'eraser') {
    return 188
  }

  return drawPanelOpen
    ? MENU_APPROX_HEIGHT.draw
    : 292
}

export const readToolPaletteMenuPlacement = ({
  key,
  drawKind,
  drawPanelOpen,
  buttonOffsetTop,
  buttonHeight,
  surfaceWidth,
  surfaceHeight
}: {
  key: ToolPaletteMenuKey
  drawKind: DrawKind
  drawPanelOpen: boolean
  buttonOffsetTop: number
  buttonHeight: number
  surfaceWidth: number
  surfaceHeight: number
}): ToolPaletteMenuPlacement => {
  const estimatedHeight = readToolPaletteMenuHeight(key, drawKind, drawPanelOpen)
  const centerY = TOOLBAR_INSET + buttonOffsetTop + buttonHeight / 2
  const minCenter = TOOLBAR_INSET + estimatedHeight / 2
  const maxCenter = Math.max(minCenter, surfaceHeight - TOOLBAR_INSET - estimatedHeight / 2)
  const minLeft = TOOLBAR_INSET + TOOLBAR_BUTTON_SIZE + MENU_OFFSET
  const width = readToolPaletteMenuWidth(key, drawKind, drawPanelOpen)
  const maxLeft = Math.max(TOOLBAR_INSET, surfaceWidth - width - TOOLBAR_INSET)

  return {
    left: Math.min(minLeft, maxLeft),
    top: Math.min(maxCenter, Math.max(minCenter, centerY)),
    width
  }
}
