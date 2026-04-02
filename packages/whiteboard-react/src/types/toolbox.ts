import type { ShapeKind } from '@whiteboard/core/node'
import type {
  DrawBrush,
  DrawSlot,
  ResolvedDrawStyle
} from '../features/draw/model'
import type {
  DrawBrushKind,
  DrawKind,
  EdgePresetKey
} from '../tool'
import type { InsertPresetGroup, StickyTone } from '../features/toolbox/model/insert'

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
