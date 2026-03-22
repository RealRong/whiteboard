import {
  Minus,
  Plus,
  Redo2,
  Scan,
  Undo2
} from 'lucide-react'
import { useInternalInstance, useStoreValue } from '../runtime/hooks'
import { ToolbarIcon } from './toolbar/ToolbarIcon'

const ZOOM_FACTOR = 1.2

const formatZoom = (zoom: number) => `${Math.round(zoom * 100)}%`

export const CanvasDock = () => {
  const instance = useInternalInstance()
  const viewport = useStoreValue(instance.viewport)
  const history = useStoreValue(instance.read.history)

  const fitToScreen = () => {
    const bounds = instance.read.canvas.bounds()
    if (!bounds) {
      return
    }
    instance.commands.viewport.fit(bounds)
  }

  return (
    <div
      className="wb-canvas-dock-layer"
      data-selection-ignore
      data-input-ignore
    >
      <div className="wb-canvas-dock">
        <div className="wb-canvas-dock-group">
          <button
            type="button"
            className="wb-canvas-dock-button"
            onClick={() => {
              instance.commands.history.undo()
            }}
            disabled={!history.canUndo || history.isApplying}
            title="Undo"
            data-selection-ignore
            data-input-ignore
          >
            <ToolbarIcon icon={Undo2} />
          </button>
          <button
            type="button"
            className="wb-canvas-dock-button"
            onClick={() => {
              instance.commands.history.redo()
            }}
            disabled={!history.canRedo || history.isApplying}
            title="Redo"
            data-selection-ignore
            data-input-ignore
          >
            <ToolbarIcon icon={Redo2} />
          </button>
        </div>
        <div className="wb-canvas-dock-divider" />
        <div className="wb-canvas-dock-group">
          <button
            type="button"
            className="wb-canvas-dock-button"
            onClick={fitToScreen}
            title="Fit to screen"
            data-selection-ignore
            data-input-ignore
          >
            <ToolbarIcon icon={Scan} />
          </button>
        </div>
        <div className="wb-canvas-dock-divider" />
        <div className="wb-canvas-dock-group">
          <button
            type="button"
            className="wb-canvas-dock-button"
            onClick={() => {
              instance.commands.viewport.zoomTo(viewport.zoom / ZOOM_FACTOR)
            }}
            title="Zoom out"
            data-selection-ignore
            data-input-ignore
          >
            <ToolbarIcon icon={Minus} />
          </button>
          <button
            type="button"
            className="wb-canvas-dock-zoom"
            onClick={() => {
              instance.commands.viewport.zoomTo(1)
            }}
            title="Reset zoom"
            data-selection-ignore
            data-input-ignore
          >
            {formatZoom(viewport.zoom)}
          </button>
          <button
            type="button"
            className="wb-canvas-dock-button"
            onClick={() => {
              instance.commands.viewport.zoomTo(viewport.zoom * ZOOM_FACTOR)
            }}
            title="Zoom in"
            data-selection-ignore
            data-input-ignore
          >
            <ToolbarIcon icon={Plus} />
          </button>
        </div>
      </div>
    </div>
  )
}
