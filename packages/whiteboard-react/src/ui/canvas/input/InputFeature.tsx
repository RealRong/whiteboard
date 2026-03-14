import type { RefObject } from 'react'
import type { ShortcutOverrides } from '../../../types/common/shortcut'
import { ShortcutInput } from './ShortcutInput'
import { CanvasSelectionInput } from './CanvasSelectionInput'
import { CanvasContextMenuInput } from './CanvasContextMenuInput'
import { EdgeInput } from './EdgeInput'

export const InputFeature = ({
  containerRef,
  shortcuts
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}) => (
  <>
    <ShortcutInput
      containerRef={containerRef}
      shortcuts={shortcuts}
    />
    <CanvasSelectionInput containerRef={containerRef} />
    <CanvasContextMenuInput containerRef={containerRef} />
    <EdgeInput containerRef={containerRef} />
  </>
)
