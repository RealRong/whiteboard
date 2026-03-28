export {
  DEFAULT_DRAW_BRUSH_KIND,
  DEFAULT_DRAW_KIND,
  DEFAULT_EDGE_PRESET_KEY,
  HandTool,
  SelectTool,
  createDrawTool,
  createEdgeTool,
  isDrawBrushKind,
  isDrawKind,
  isSameTool,
  matchTool,
  normalizeTool,
  readEdgeType
} from './runtime/tool'
export type {
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
} from './runtime/tool'
