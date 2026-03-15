import type { RefObject } from 'react'
import type { ShortcutOverrides } from '../../../types/common/shortcut'
import type { ContextMenuOpenResult } from '../../context-menu/model'
import { ShortcutInput } from './ShortcutInput'
import { ContextMenuInput } from './ContextMenuInput'
import { useEdgeConnect } from '../../../features/edge/hooks/connect/useEdgeConnect'
import { useSelectionBox } from './useSelectionBox'

export const InputFeature = ({
  containerRef,
  shortcuts,
  onOpenContextMenu
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
  onOpenContextMenu: (result: ContextMenuOpenResult) => void
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
      <ContextMenuInput
        containerRef={containerRef}
        onOpenContextMenu={onOpenContextMenu}
      />
    </>
  )
}
