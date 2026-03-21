import {
  GitBranch,
  Hand,
  MousePointer2,
  PencilLine,
  Shapes,
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
  useInternalInstance,
  useStoreValue,
  useTool
} from '../../runtime/hooks'
import {
  DEFAULT_DRAW_PRESET_KEY,
  DEFAULT_EDGE_PRESET_KEY,
  type DrawPresetKey,
  type EdgePresetKey
} from '../../runtime/tool'
import { EdgeMenu, EdgePresetGlyph } from './menus/EdgeMenu'
import { DrawMenu } from './menus/DrawMenu'
import { StickyMenu } from './menus/StickyMenu'
import { ShapeMenu } from './menus/ShapeMenu'
import { MindmapMenu } from './menus/MindmapMenu'
import { ToolbarIcon } from './ToolbarIcon'
import {
  DEFAULT_MINDMAP_PRESET_KEY,
  DEFAULT_SHAPE_PRESET_KEY,
  DEFAULT_STICKY_PRESET_KEY,
  TEXT_INSERT_PRESET,
  readStickyInsertTone,
  readInsertPresetGroup
} from './presets'

type Surface = {
  width: number
  height: number
}

type MenuKey =
  | 'draw'
  | 'edge'
  | 'sticky'
  | 'shape'
  | 'mindmap'

const ToolbarInset = 16
const ToolbarButtonSize = 40
const MenuOffset = 10
const MenuWidth = 240

const MenuApproxHeight: Record<MenuKey, number> = {
  draw: 244,
  edge: 164,
  sticky: 164,
  shape: 252,
  mindmap: 248
}

export const LeftToolbar = ({
  surface
}: {
  surface: Surface
}) => {
  const instance = useInternalInstance()
  const tool = useTool()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const drawPresetRef = useRef<DrawPresetKey>(DEFAULT_DRAW_PRESET_KEY)
  const edgePresetRef = useRef<EdgePresetKey>(DEFAULT_EDGE_PRESET_KEY)
  const buttonRefByKey = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({})
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const drawStyles = useStoreValue(instance.state.draw)
  const insertGroup = tool.type === 'insert'
    ? readInsertPresetGroup(tool.preset)
    : undefined
  const stickyTone = readStickyInsertTone(
    tool.type === 'insert' && insertGroup === 'sticky'
      ? tool.preset
      : DEFAULT_STICKY_PRESET_KEY
  )
  const edgePreset = tool.type === 'edge'
    ? tool.preset
    : edgePresetRef.current
  const drawPreset = tool.type === 'draw'
    ? tool.preset
    : drawPresetRef.current
  const drawStyle = drawStyles[drawPreset]

  useEffect(() => {
    if (tool.type === 'draw') {
      drawPresetRef.current = tool.preset
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

    const estimatedHeight = MenuApproxHeight[openMenu]
    const centerY = ToolbarInset + button.offsetTop + button.offsetHeight / 2
    const minCenter = ToolbarInset + estimatedHeight / 2
    const maxCenter = Math.max(minCenter, surface.height - ToolbarInset - estimatedHeight / 2)
    const minLeft = ToolbarInset + ToolbarButtonSize + MenuOffset
    const maxLeft = Math.max(ToolbarInset, surface.width - MenuWidth - ToolbarInset)

    return {
      left: Math.min(minLeft, maxLeft),
      top: Math.min(maxCenter, Math.max(minCenter, centerY)),
      width: MenuWidth
    }
  }, [openMenu, surface.height, surface.width])

  const closeMenu = () => {
    setOpenMenu(null)
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
          <ToolbarIcon icon={toolIcon} />
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
          <ToolbarIcon icon={StickyNote} />
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
          <ToolbarIcon icon={Type} />
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
          <ToolbarIcon icon={Shapes} />
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
              instance.commands.tool.draw(drawPreset)
              setOpenMenu('draw')
              return
            }

            setOpenMenu((current) => current === 'draw' ? null : 'draw')
          }}
          data-selection-ignore
          data-input-ignore
          title="Draw"
        >
          <span
            className="wb-left-toolbar-button-tint"
            style={{
              background: drawStyle.color,
              opacity: drawStyle.opacity
            }}
          />
          <ToolbarIcon icon={PencilLine} />
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
          <ToolbarIcon icon={GitBranch} />
        </button>
      </div>
      {openMenu && menuStyle ? (
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
          {openMenu === 'draw' ? (
            <DrawMenu
              preset={drawPreset}
              style={drawStyle}
              onPreset={(value) => {
                instance.commands.tool.draw(value)
              }}
              onColor={(value) => {
                instance.commands.draw.patch(drawPreset, { color: value })
              }}
              onWidth={(value) => {
                instance.commands.draw.patch(drawPreset, { width: value })
              }}
            />
          ) : null}
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
              value={tool.type === 'insert' && insertGroup === 'shape' ? tool.preset : DEFAULT_SHAPE_PRESET_KEY}
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
