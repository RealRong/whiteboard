import {
  drawTool,
  edgeTool,
  insertTool,
  type EdgePresetKey
} from '@whiteboard/editor'
import type { Dispatch, SetStateAction } from 'react'
import type { WhiteboardRuntime as Editor } from '../../types/runtime'
import type {
  ToolPaletteMenuKey,
  ToolPaletteView
} from '../../types/toolbox'
import { DrawMenu } from './menus/DrawMenu'
import { EdgeMenu } from './menus/EdgeMenu'
import { MindmapMenu } from './menus/MindmapMenu'
import { ShapeMenu } from './menus/ShapeMenu'
import { StickyMenu } from './menus/StickyMenu'

type ToolPaletteMenuPlacement = {
  left: number
  top: number
  width: number
}

export const ToolPaletteMenu = ({
  editor,
  openMenu,
  menuStyle,
  palette,
  drawPanelOpen,
  setDrawPanelOpen,
  closeMenu,
  edgePresetRef
}: {
  editor: Editor
  openMenu: ToolPaletteMenuKey | null
  menuStyle?: ToolPaletteMenuPlacement
  palette: ToolPaletteView
  drawPanelOpen: boolean
  setDrawPanelOpen: Dispatch<SetStateAction<boolean>>
  closeMenu: () => void
  edgePresetRef: {
    current: EdgePresetKey
  }
}) => {
  if (!openMenu || !menuStyle) {
    return null
  }

  if (openMenu === 'draw') {
    return (
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
            editor.commands.tool.set(drawTool(value))
          }}
          onSlot={(value) => {
            if (value === palette.drawBrush.slot) {
              setDrawPanelOpen((current) => !current)
              return
            }

            editor.commands.draw.slot(value)
            setDrawPanelOpen(true)
          }}
          onPatch={(patch) => {
            editor.commands.draw.patch(patch)
          }}
        />
      </div>
    )
  }

  return (
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
            editor.commands.tool.set(edgeTool(value))
          }}
        />
      ) : null}
      {openMenu === 'sticky' ? (
        <StickyMenu
          value={palette.stickyPreset}
          onChange={(value) => {
            closeMenu()
            editor.commands.tool.set(insertTool(value))
          }}
        />
      ) : null}
      {openMenu === 'shape' ? (
        <ShapeMenu
          value={palette.shapePreset}
          onChange={(value) => {
            closeMenu()
            editor.commands.tool.set(insertTool(value))
          }}
        />
      ) : null}
      {openMenu === 'mindmap' ? (
        <MindmapMenu
          value={palette.mindmapPreset}
          onChange={(value) => {
            closeMenu()
            editor.commands.tool.set(insertTool(value))
          }}
        />
      ) : null}
    </div>
  )
}
