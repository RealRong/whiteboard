import {
  Eraser,
  GitBranch,
  Hand,
  Highlighter,
  MousePointer2,
  PencilLine,
  StickyNote,
  Type
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
  readShapePreviewFill
} from '../node/shape'
import {
  DEFAULT_DRAW_BRUSH_KIND,
  DEFAULT_DRAW_KIND,
  DEFAULT_EDGE_PRESET_KEY,
  isDrawBrushKind,
  type DrawBrushKind,
  type DrawKind,
  type EdgePresetKey
} from '../../runtime/tool'
import { EdgeMenu, EdgePresetGlyph } from './menus/EdgeMenu'
import { DrawMenu } from './menus/DrawMenu'
import { StickyMenu } from './menus/StickyMenu'
import { ShapeMenu } from './menus/ShapeMenu'
import { MindmapMenu } from './menus/MindmapMenu'
import { ToolIcon } from './ToolIcon'
import {
  readDrawSlot,
  readDrawStyle,
  type DrawBrush,
  type DrawState,
  type DrawSlot
} from '../draw/state'
import {
  DEFAULT_MINDMAP_PRESET_KEY,
  DEFAULT_SHAPE_PRESET_KEY,
  DEFAULT_STICKY_PRESET_KEY,
  TEXT_INSERT_PRESET,
  readShapePresetKind,
  readStickyInsertTone,
  readInsertPresetGroup
} from './presets'

type MenuKey =
  | 'draw'
  | 'edge'
  | 'sticky'
  | 'shape'
  | 'mindmap'

const ToolbarInset = 16
const ToolbarButtonSize = 40
const MenuOffset = 10
const MenuWidth: Record<MenuKey, number> = {
  draw: 360,
  edge: 240,
  sticky: 240,
  shape: 240,
  mindmap: 240
}

const MenuApproxHeight: Record<MenuKey, number> = {
  draw: 324,
  edge: 164,
  sticky: 164,
  shape: 388,
  mindmap: 248
}

const readMenuWidth = (
  key: MenuKey,
  drawKind: DrawKind,
  drawPanelOpen: boolean
) => (
  key === 'draw' && (!drawPanelOpen || drawKind === 'eraser')
    ? 72
    : MenuWidth[key]
)

const readMenuHeight = (
  key: MenuKey,
  drawKind: DrawKind,
  drawPanelOpen: boolean
) => {
  if (key !== 'draw') {
    return MenuApproxHeight[key]
  }

  if (drawKind === 'eraser') {
    return 188
  }

  return drawPanelOpen
    ? MenuApproxHeight.draw
    : 292
}

const DRAW_KIND_ICON = {
  pen: PencilLine,
  highlighter: Highlighter,
  eraser: Eraser
} as const satisfies Record<DrawKind, typeof PencilLine>

const readBrushState = (
  state: DrawState,
  kind: DrawKind
): {
  brushKind: DrawBrushKind
  brush: DrawBrush
  slot: DrawSlot
} => {
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
  const buttonRefByKey = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({})
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const [drawPanelOpen, setDrawPanelOpen] = useState(false)
  const drawState = useStoreValue(instance.state.draw)
  const insertGroup = tool.type === 'insert'
    ? readInsertPresetGroup(tool.preset)
    : undefined
  const stickyTone = readStickyInsertTone(
    tool.type === 'insert' && insertGroup === 'sticky'
      ? tool.preset
      : DEFAULT_STICKY_PRESET_KEY
  )
  const shapePreset = tool.type === 'insert' && insertGroup === 'shape'
    ? tool.preset
    : DEFAULT_SHAPE_PRESET_KEY
  const shapeKind = readShapePresetKind(shapePreset)
  const edgePreset = tool.type === 'edge'
    ? tool.preset
    : edgePresetRef.current
  const drawKind = tool.type === 'draw'
    ? tool.kind
    : drawKindRef.current
  const drawBrushState = readBrushState(drawState, drawKind)
  const drawStyle = readDrawStyle(drawState, drawBrushState.brushKind)
  const drawButtonStyle = isDrawBrushKind(drawKind)
    ? drawStyle
    : undefined
  const DrawButtonIcon = DRAW_KIND_ICON[drawKind]

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

    const estimatedHeight = readMenuHeight(openMenu, drawKind, drawPanelOpen)
    const centerY = ToolbarInset + button.offsetTop + button.offsetHeight / 2
    const minCenter = ToolbarInset + estimatedHeight / 2
    const maxCenter = Math.max(minCenter, surface.height - ToolbarInset - estimatedHeight / 2)
    const minLeft = ToolbarInset + ToolbarButtonSize + MenuOffset
    const menuWidth = readMenuWidth(openMenu, drawKind, drawPanelOpen)
    const maxLeft = Math.max(ToolbarInset, surface.width - menuWidth - ToolbarInset)

    return {
      left: Math.min(minLeft, maxLeft),
      top: Math.min(maxCenter, Math.max(minCenter, centerY)),
      width: menuWidth
    }
  }, [drawKind, drawPanelOpen, openMenu, surface.height, surface.width])

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
              instance.commands.tool.edge(edgePreset)
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
            <EdgePresetGlyph preset={edgePreset} />
          </span>
        </button>
        <button
          ref={(element) => {
            buttonRefByKey.current.sticky = element
          }}
          type="button"
          className="wb-left-toolbar-button"
          data-active={insertGroup === 'sticky' ? 'true' : undefined}
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
              background: stickyTone?.fill
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
          data-active={insertGroup === 'shape' ? 'true' : undefined}
          onClick={() => {
            setOpenMenu((current) => current === 'shape' ? null : 'shape')
          }}
          data-selection-ignore
          data-input-ignore
          title="Shapes"
        >
          {shapeKind ? (
            <span className="wb-left-toolbar-button-shape-preview">
              <ShapeGlyph
                kind={shapeKind}
                width={22}
                height={22}
                strokeWidth={4}
                fill={readShapePreviewFill(shapeKind)}
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
              instance.commands.tool.draw(drawKind)
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
          {drawButtonStyle ? (
            <span
              className="wb-left-toolbar-button-tint"
              style={{
                background: drawButtonStyle.color,
                opacity: drawButtonStyle.opacity
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
          data-active={insertGroup === 'mindmap' ? 'true' : undefined}
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
            kind={drawKind}
            activeSlot={drawBrushState.slot}
            slots={drawBrushState.brush.slots}
            panelOpen={drawPanelOpen}
            onKind={(value) => {
              setDrawPanelOpen(false)
              instance.commands.tool.draw(value)
            }}
            onSlot={(value) => {
              if (value === drawBrushState.slot) {
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
              value={edgePreset}
              onChange={(value) => {
                closeMenu()
                edgePresetRef.current = value
                instance.commands.tool.edge(value)
              }}
            />
          ) : null}
          {openMenu === 'sticky' ? (
            <StickyMenu
              value={tool.type === 'insert' && insertGroup === 'sticky' ? tool.preset : DEFAULT_STICKY_PRESET_KEY}
              onChange={(value) => {
                closeMenu()
                instance.commands.tool.insert(value)
              }}
            />
          ) : null}
          {openMenu === 'shape' ? (
            <ShapeMenu
              value={shapePreset}
              onChange={(value) => {
                closeMenu()
                instance.commands.tool.insert(value)
              }}
            />
          ) : null}
          {openMenu === 'mindmap' ? (
            <MindmapMenu
              value={tool.type === 'insert' && insertGroup === 'mindmap' ? tool.preset : DEFAULT_MINDMAP_PRESET_KEY}
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
