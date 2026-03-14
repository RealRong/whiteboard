import type { RefObject } from 'react'
import type { ShortcutOverrides } from '../../../types/common/shortcut'
import { ShortcutInput } from './ShortcutInput'
import { CanvasContextMenuInput } from './CanvasContextMenuInput'
import { useEdgeConnect } from '../../../features/edge/hooks/connect/useEdgeConnect'
import { useSelectionBox } from './useSelectionBox'

export const InputFeature = ({
  containerRef,
  shortcuts
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}) => {
  useSelectionBox({
    containerRef
  })
  useEdgeConnect({
    containerRef
  })

  return (
    <>
      <ShortcutInput
        containerRef={containerRef}
        shortcuts={shortcuts}
      />
      <CanvasContextMenuInput containerRef={containerRef} />
    </>
  )
}
