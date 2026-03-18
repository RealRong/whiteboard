import {
  GitBranch,
  Hand,
  MousePointer2,
  PencilLine,
  Shapes,
  SquareMousePointer,
  StickyNote,
  Type,
  Waypoints
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  useInternalInstance,
  useTool
} from '../../runtime/hooks'
import type { Tool } from '../../runtime/tool'
import { ToolMenu, type ToolMenuValue } from './menus/ToolMenu'
import { StickyMenu } from './menus/StickyMenu'
import { ShapeMenu } from './menus/ShapeMenu'
import { MindmapMenu } from './menus/MindmapMenu'
import { ToolbarIcon } from './ToolbarIcon'
import {
  DEFAULT_MINDMAP_PRESET_KEY,
  DEFAULT_SHAPE_PRESET_KEY,
  DEFAULT_STICKY_PRESET_KEY,
  TEXT_INSERT_PRESET,
  readInsertPresetGroup
} from './presets'

type Surface = {
  width: number
  height: number
}

type MenuKey =
  | 'tool'
  | 'sticky'
  | 'shape'
  | 'mindmap'

const ToolbarInset = 16
const ToolbarButtonSize = 40
const MenuOffset = 10
const MenuWidth = 240

const MenuApproxHeight: Record<MenuKey, number> = {
  tool: 144,
  sticky: 220,
  shape: 256,
  mindmap: 236
}

const resolveToolMenuValue = (tool: Tool): ToolMenuValue => {
  if (tool.type === 'hand') {
    return 'hand'
  }
  if (tool.type === 'connector') {
    return 'connector'
  }
  return 'select'
}

const resolveToolIcon = (tool: Tool) => {
  if (tool.type === 'hand') {
    return Hand
  }
  if (tool.type === 'connector') {
    return Waypoints
  }
  return MousePointer2
}

export const LeftToolbar = ({
  surface
}: {
  surface: Surface
}) => {
  const instance = useInternalInstance()
  const tool = useTool()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRefByKey = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({})
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const insertGroup = tool.type === 'insert'
    ? readInsertPresetGroup(tool.preset)
    : undefined

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

  const toolIcon = resolveToolIcon(tool)

  return (
    <div
      ref={rootRef}
      className="wb-left-toolbar-layer"
      data-selection-ignore
      data-input-ignore
    >
      <div className="wb-left-toolbar">
        <button
          ref={(element) => {
            buttonRefByKey.current.tool = element
          }}
        type="button"
        className="wb-left-toolbar-button"
        data-active={tool.type === 'select' || tool.type === 'hand' || tool.type === 'connector' ? 'true' : undefined}
        onClick={() => {
          setOpenMenu((current) => current === 'tool' ? null : 'tool')
        }}
          data-selection-ignore
          data-input-ignore
          title="Tool"
        >
          <ToolbarIcon icon={toolIcon} />
        </button>
        <div className="wb-left-toolbar-divider" />
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
        <div className="wb-left-toolbar-divider" />
        <button
          type="button"
          className="wb-left-toolbar-button"
          data-active={tool.type === 'draw' ? 'true' : undefined}
          disabled
          onClick={() => {
            closeMenu()
            instance.commands.tool.draw('free')
          }}
          data-selection-ignore
          data-input-ignore
          title="Freedraw"
        >
          <ToolbarIcon icon={PencilLine} />
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
          {openMenu === 'tool' ? (
            <ToolMenu
              value={resolveToolMenuValue(tool)}
              onChange={(value) => {
                closeMenu()
                if (value === 'hand') {
                  instance.commands.tool.hand()
                  return
                }
                if (value === 'connector') {
                  instance.commands.tool.connector()
                  return
                }
                instance.commands.tool.select()
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
      {tool.type === 'insert' || tool.type === 'draw' ? (
        <div className="wb-left-toolbar-hint" data-selection-ignore data-input-ignore>
          <div className="wb-left-toolbar-hint-icon">
            <ToolbarIcon icon={SquareMousePointer} />
          </div>
          <div className="wb-left-toolbar-hint-text">
            点击画布放置
          </div>
        </div>
      ) : null}
    </div>
  )
}
