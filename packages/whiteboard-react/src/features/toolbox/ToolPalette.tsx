import {
  readDrawSlot,
  readDrawStyle,
  type DrawBrush,
  type DrawPreferences as DrawState,
  type DrawSlot,
  type ResolvedDrawStyle
} from '@whiteboard/editor'
import {
  Eraser,
  GitBranch,
  Hand,
  Highlighter,
  MousePointer2,
  PencilLine,
  StickyNote,
  Type,
  type LucideIcon
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  useElementSize,
  useInternalInstance,
  useStoreValue,
  useTool
} from '../../runtime/hooks'
import {
  ShapeGlyph,
  readShapePreviewFill,
  type ShapeKind
} from '../node/shape'
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
import { EdgeMenu, EdgePresetGlyph } from './menus/EdgeMenu'
import { DrawMenu } from './menus/DrawMenu'
import { StickyMenu } from './menus/StickyMenu'
import { ShapeMenu } from './menus/ShapeMenu'
import { MindmapMenu } from './menus/MindmapMenu'
import {
  DEFAULT_MINDMAP_PRESET_KEY,
  DEFAULT_SHAPE_PRESET_KEY,
  DEFAULT_STICKY_PRESET_KEY,
  TEXT_INSERT_PRESET,
  readInsertPresetGroup,
  readShapePresetKind,
  readStickyInsertTone,
  type InsertPresetGroup,
  type StickyTone
} from './presets'

type ToolPaletteMenuKey =
  | 'draw'
  | 'edge'
  | 'sticky'
  | 'shape'
  | 'mindmap'

type ToolPaletteBrushState = {
  brushKind: DrawBrushKind
  brush: DrawBrush
  slot: DrawSlot
}

type ToolPaletteView = {
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

type ToolPaletteMenuPlacement = {
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

const readToolPaletteBrushState = (
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

const readToolPaletteView = ({
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

const readToolPaletteMenuWidth = (
  key: ToolPaletteMenuKey,
  drawKind: DrawKind,
  drawPanelOpen: boolean
) => (
  key === 'draw' && (!drawPanelOpen || drawKind === 'eraser')
    ? 72
    : MENU_WIDTH[key]
)

const readToolPaletteMenuHeight = (
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

const readToolPaletteMenuPlacement = ({
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

const ToolIcon = ({
  icon: Icon
}: {
  icon: LucideIcon
}) => (
  <Icon
    size={18}
    strokeWidth={1}
    absoluteStrokeWidth
  />
)

const DRAW_KIND_ICON = {
  pen: PencilLine,
  highlighter: Highlighter,
  eraser: Eraser
} as const satisfies Record<DrawKind, typeof PencilLine>

export const ToolPalette = ({
  containerRef
}: {
  containerRef: {
    current: HTMLDivElement | null
  }
}) => {
  const instance = useInternalInstance()
  const tool = useTool()
  const surface = useElementSize(containerRef)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const drawKindRef = useRef<DrawKind>(DEFAULT_DRAW_KIND)
  const edgePresetRef = useRef<EdgePresetKey>(DEFAULT_EDGE_PRESET_KEY)
  const buttonRefByKey = useRef<Partial<Record<ToolPaletteMenuKey, HTMLButtonElement | null>>>({})
  const [openMenu, setOpenMenu] = useState<ToolPaletteMenuKey | null>(null)
  const [drawPanelOpen, setDrawPanelOpen] = useState(false)
  const drawState = useStoreValue(instance.state.draw)
  const palette = readToolPaletteView({
    tool,
    drawState,
    lastDrawKind: drawKindRef.current,
    lastEdgePreset: edgePresetRef.current
  })
  const DrawButtonIcon = DRAW_KIND_ICON[palette.drawKind]

  useEffect(() => {
    if (tool.type === 'draw') {
      drawKindRef.current = tool.kind
    }
  }, [tool])

  useEffect(() => {
    if (tool.type === 'edge') {
      edgePresetRef.current = tool.preset
    }
  }, [tool])

  const menuStyle = useMemo(() => {
    if (!openMenu) {
      return undefined
    }

    const button = buttonRefByKey.current[openMenu]
    if (!button) {
      return undefined
    }

    return readToolPaletteMenuPlacement({
      key: openMenu,
      drawKind: palette.drawKind,
      drawPanelOpen,
      buttonOffsetTop: button.offsetTop,
      buttonHeight: button.offsetHeight,
      surfaceWidth: surface.width,
      surfaceHeight: surface.height
    })
  }, [drawPanelOpen, openMenu, palette.drawKind, surface.height, surface.width])

  const closeMenu = () => {
    setOpenMenu(null)
    setDrawPanelOpen(false)
  }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) {
        return
      }
      closeMenu()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (surface.width <= 0 || surface.height <= 0) {
      closeMenu()
    }
  }, [surface.height, surface.width])

  const toolIcon = tool.type === 'hand' ? Hand : MousePointer2

  return (
    <div
      ref={rootRef}
      className="wb-left-toolbar-layer"
      data-selection-ignore
      data-input-ignore
    >
      <div className="wb-left-toolbar">
        <button
          type="button"
          className="wb-left-toolbar-button"
          data-active={tool.type === 'select' || tool.type === 'hand' ? 'true' : undefined}
          onClick={() => {
            closeMenu()
            if (tool.type === 'hand') {
              instance.commands.tool.select()
              return
            }
            if (tool.type !== 'select') {
              instance.commands.tool.select()
              return
            }
            instance.commands.tool.hand()
          }}
          data-selection-ignore
          data-input-ignore
          title={tool.type === 'hand' ? 'Hand' : 'Select'}
        >
          <ToolIcon icon={toolIcon} />
        </button>
        <div className="wb-left-toolbar-divider" />
        <button
          ref={(element) => {
            buttonRefByKey.current.edge = element
          }}
          type="button"
          className="wb-left-toolbar-button"
          data-active={tool.type === 'edge' ? 'true' : undefined}
          onClick={() => {
            if (tool.type !== 'edge') {
              instance.commands.tool.edge(palette.edgePreset)
              setOpenMenu('edge')
              return
            }

            setOpenMenu((current) => current === 'edge' ? null : 'edge')
          }}
          data-selection-ignore
          data-input-ignore
          title="Edge"
        >
          <span className="wb-left-toolbar-button-edge-preview">
            <EdgePresetGlyph preset={palette.edgePreset} />
          </span>
        </button>
        <button
          ref={(element) => {
            buttonRefByKey.current.sticky = element
          }}
          type="button"
          className="wb-left-toolbar-button"
          data-active={palette.insertGroup === 'sticky' ? 'true' : undefined}
          onClick={() => {
            setOpenMenu((current) => current === 'sticky' ? null : 'sticky')
          }}
          data-selection-ignore
          data-input-ignore
          title="Sticky note"
        >
          <span
            className="wb-left-toolbar-button-tint"
            style={{
              background: palette.stickyTone?.fill
            }}
          />
          <ToolIcon icon={StickyNote} />
        </button>
        <button
          type="button"
          className="wb-left-toolbar-button"
          data-active={tool.type === 'insert' && tool.preset === TEXT_INSERT_PRESET.key ? 'true' : undefined}
          onClick={() => {
            closeMenu()
            instance.commands.tool.insert(TEXT_INSERT_PRESET.key)
          }}
          data-selection-ignore
          data-input-ignore
          title="Text"
        >
          <ToolIcon icon={Type} />
        </button>
        <button
          ref={(element) => {
            buttonRefByKey.current.shape = element
          }}
          type="button"
          className="wb-left-toolbar-button"
          data-active={palette.insertGroup === 'shape' ? 'true' : undefined}
          onClick={() => {
            setOpenMenu((current) => current === 'shape' ? null : 'shape')
          }}
          data-selection-ignore
          data-input-ignore
          title="Shapes"
        >
          {palette.shapeKind ? (
            <span className="wb-left-toolbar-button-shape-preview">
              <ShapeGlyph
                kind={palette.shapeKind}
                width={22}
                height={22}
                strokeWidth={4}
                fill={readShapePreviewFill(palette.shapeKind)}
                stroke="currentColor"
              />
            </span>
          ) : null}
        </button>
        <button
          ref={(element) => {
            buttonRefByKey.current.draw = element
          }}
          type="button"
          className="wb-left-toolbar-button"
          data-active={tool.type === 'draw' ? 'true' : undefined}
          onClick={() => {
            if (tool.type !== 'draw') {
              instance.commands.tool.draw(palette.drawKind)
              setDrawPanelOpen(false)
              setOpenMenu('draw')
              return
            }

            if (openMenu === 'draw') {
              closeMenu()
              return
            }

            setDrawPanelOpen(false)
            setOpenMenu('draw')
          }}
          data-selection-ignore
          data-input-ignore
          title="Draw"
        >
          {palette.drawButtonStyle ? (
            <span
              className="wb-left-toolbar-button-tint"
              style={{
                background: palette.drawButtonStyle.color,
                opacity: palette.drawButtonStyle.opacity
              }}
            />
          ) : null}
          <ToolIcon icon={DrawButtonIcon} />
        </button>
        <button
          ref={(element) => {
            buttonRefByKey.current.mindmap = element
          }}
          type="button"
          className="wb-left-toolbar-button"
          data-active={palette.insertGroup === 'mindmap' ? 'true' : undefined}
          onClick={() => {
            setOpenMenu((current) => current === 'mindmap' ? null : 'mindmap')
          }}
          data-selection-ignore
          data-input-ignore
          title="Mindmap"
        >
          <ToolIcon icon={GitBranch} />
        </button>
      </div>
      {openMenu === 'draw' && menuStyle ? (
        <div
          className="wb-left-toolbar-draw-floating"
          style={{
            left: menuStyle.left,
            top: menuStyle.top,
            transform: 'translateY(-50%)'
          }}
          data-selection-ignore
          data-input-ignore
        >
          <DrawMenu
            kind={palette.drawKind}
            activeSlot={palette.drawBrush.slot}
            slots={palette.drawBrush.brush.slots}
            panelOpen={drawPanelOpen}
            onKind={(value) => {
              setDrawPanelOpen(false)
              instance.commands.tool.draw(value)
            }}
            onSlot={(value) => {
              if (value === palette.drawBrush.slot) {
                setDrawPanelOpen((current) => !current)
                return
              }

              instance.commands.draw.slot(value)
              setDrawPanelOpen(true)
            }}
            onPatch={(patch) => {
              instance.commands.draw.patch(patch)
            }}
          />
        </div>
      ) : null}
      {openMenu && openMenu !== 'draw' && menuStyle ? (
        <div
          className="wb-left-toolbar-menu"
          style={{
            left: menuStyle.left,
            top: menuStyle.top,
            width: menuStyle.width,
            transform: 'translateY(-50%)'
          }}
          data-selection-ignore
          data-input-ignore
        >
          {openMenu === 'edge' ? (
            <EdgeMenu
              value={palette.edgePreset}
              onChange={(value) => {
                closeMenu()
                edgePresetRef.current = value
                instance.commands.tool.edge(value)
              }}
            />
          ) : null}
          {openMenu === 'sticky' ? (
            <StickyMenu
              value={palette.stickyPreset}
              onChange={(value) => {
                closeMenu()
                instance.commands.tool.insert(value)
              }}
            />
          ) : null}
          {openMenu === 'shape' ? (
            <ShapeMenu
              value={palette.shapePreset}
              onChange={(value) => {
                closeMenu()
                instance.commands.tool.insert(value)
              }}
            />
          ) : null}
          {openMenu === 'mindmap' ? (
            <MindmapMenu
              value={palette.mindmapPreset}
              onChange={(value) => {
                closeMenu()
                instance.commands.tool.insert(value)
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
