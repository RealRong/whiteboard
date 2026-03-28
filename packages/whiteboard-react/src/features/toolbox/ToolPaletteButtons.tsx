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
  DEFAULT_DRAW_KIND,
  type DrawKind,
  type Tool
} from '@whiteboard/editor'
import type { Dispatch, SetStateAction } from 'react'
import type { Editor } from '../../runtime/editor'
import {
  ShapeGlyph,
  readShapePreviewFill
} from '../node/shape'
import { EdgePresetGlyph } from './menus/EdgeMenu'
import { TEXT_INSERT_PRESET } from './presets'
import type {
  ToolPaletteMenuKey,
  ToolPaletteView
} from './model'

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

export const ToolPaletteButtons = ({
  editor,
  tool,
  palette,
  openMenu,
  closeMenu,
  setOpenMenu,
  setDrawPanelOpen,
  buttonRefByKey
}: {
  editor: Editor
  tool: Tool
  palette: ToolPaletteView
  openMenu: ToolPaletteMenuKey | null
  closeMenu: () => void
  setOpenMenu: Dispatch<SetStateAction<ToolPaletteMenuKey | null>>
  setDrawPanelOpen: Dispatch<SetStateAction<boolean>>
  buttonRefByKey: {
    current: Partial<Record<ToolPaletteMenuKey, HTMLButtonElement | null>>
  }
}) => {
  const DrawButtonIcon = DRAW_KIND_ICON[palette.drawKind ?? DEFAULT_DRAW_KIND]
  const toolIcon = tool.type === 'hand' ? Hand : MousePointer2

  return (
    <div className="wb-left-toolbar">
      <button
        type="button"
        className="wb-left-toolbar-button"
        data-active={tool.type === 'select' || tool.type === 'hand' ? 'true' : undefined}
        onClick={() => {
          closeMenu()
          if (tool.type === 'hand') {
            editor.commands.tool.select()
            return
          }
          if (tool.type !== 'select') {
            editor.commands.tool.select()
            return
          }
          editor.commands.tool.hand()
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
            editor.commands.tool.edge(palette.edgePreset)
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
          editor.commands.tool.insert(TEXT_INSERT_PRESET.key)
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
            editor.commands.tool.draw(palette.drawKind)
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
  )
}
