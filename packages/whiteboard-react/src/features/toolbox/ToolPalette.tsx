import {
  DEFAULT_DRAW_KIND,
  DEFAULT_EDGE_PRESET_KEY,
  type DrawKind,
  type EdgePresetKey
} from '@whiteboard/editor'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  useElementSize,
  useEditor,
  useStoreValue,
  useTool
} from '../../runtime/hooks'
import { useOverlayDismiss } from '../../runtime/overlay/useOverlayDismiss'
import { ToolPaletteButtons } from './ToolPaletteButtons'
import { ToolPaletteMenu } from './ToolPaletteMenu'
import {
  readToolPaletteView,
  type ToolPaletteMenuKey
} from './model'

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

export const ToolPalette = ({
  containerRef
}: {
  containerRef: {
    current: HTMLDivElement | null
  }
}) => {
  const editor = useEditor()
  const tool = useTool()
  const surface = useElementSize(containerRef)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const drawKindRef = useRef<DrawKind>(DEFAULT_DRAW_KIND)
  const edgePresetRef = useRef<EdgePresetKey>(DEFAULT_EDGE_PRESET_KEY)
  const buttonRefByKey = useRef<Partial<Record<ToolPaletteMenuKey, HTMLButtonElement | null>>>({})
  const [openMenu, setOpenMenu] = useState<ToolPaletteMenuKey | null>(null)
  const [drawPanelOpen, setDrawPanelOpen] = useState(false)
  const drawState = useStoreValue(editor.state.draw)
  const palette = readToolPaletteView({
    tool,
    drawState,
    lastDrawKind: drawKindRef.current,
    lastEdgePreset: edgePresetRef.current
  })

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

  const closeMenu = useCallback(() => {
    setOpenMenu(null)
    setDrawPanelOpen(false)
  }, [])

  useOverlayDismiss({
    enabled: openMenu !== null,
    rootRef,
    onDismiss: closeMenu
  })

  useEffect(() => {
    if (surface.width <= 0 || surface.height <= 0) {
      closeMenu()
    }
  }, [closeMenu, surface.height, surface.width])

  return (
    <div
      ref={rootRef}
      className="wb-left-toolbar-layer"
      data-selection-ignore
      data-input-ignore
    >
      <ToolPaletteButtons
        editor={editor}
        tool={tool}
        palette={palette}
        openMenu={openMenu}
        closeMenu={closeMenu}
        setOpenMenu={setOpenMenu}
        setDrawPanelOpen={setDrawPanelOpen}
        buttonRefByKey={buttonRefByKey}
      />
      <ToolPaletteMenu
        editor={editor}
        openMenu={openMenu}
        menuStyle={menuStyle}
        palette={palette}
        drawPanelOpen={drawPanelOpen}
        setDrawPanelOpen={setDrawPanelOpen}
        closeMenu={closeMenu}
        edgePresetRef={edgePresetRef}
      />
    </div>
  )
}
