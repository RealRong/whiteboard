import type { RefObject } from 'react'
import type { ShortcutOverrides } from '../types/common/shortcut'
import { ContextMenu } from '../features/selection/chrome/ContextMenu'
import {
  Marquee,
  type MarqueeSession
} from '../features/selection/Marquee'
import { NodeToolbar } from '../features/selection/chrome/NodeToolbar'
import { ToolPalette } from '../features/toolbox/ToolPalette'
import { ViewportDock } from '../features/viewport/ViewportDock'
import { useCanvasKeyboard } from './useCanvasKeyboard'

export const CanvasChrome = ({
  containerRef,
  shortcuts,
  marquee
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
  marquee: MarqueeSession
}) => {
  useCanvasKeyboard({
    containerRef,
    shortcuts
  })

  return (
    <>
      <ToolPalette containerRef={containerRef} />
      <ViewportDock />
      <Marquee
        marquee={marquee}
      />
      <NodeToolbar
        containerRef={containerRef}
      />
      <ContextMenu
        containerRef={containerRef}
      />
    </>
  )
}
