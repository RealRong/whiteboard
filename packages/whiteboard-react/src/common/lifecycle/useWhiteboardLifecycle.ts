import { useEffect } from 'react'
import type { NodeId, Viewport } from '@whiteboard/core'
import type { Shortcut } from '../shortcuts/types'
import { useCanvasEventBindings } from './useCanvasEventBindings'
import { useEdgeSelectionNotifications } from './useEdgeSelectionNotifications'
import { useInstanceCommands } from './useInstanceCommands'
import { useSelectionNotifications } from './useSelectionNotifications'
import { useSpacePressedLifecycle } from './useSpacePressedLifecycle'
import { useShortcutRegistry } from '../shortcuts/lifecycle/useShortcutRegistry'
import { useShortcutStateSync } from '../shortcuts/lifecycle/useShortcutStateSync'
import { useSelection } from '../../node/hooks'
import { useInstance } from '../hooks/useInstance'
import { DEFAULT_GROUP_PADDING } from '../../node/constants'
import { useCanvasHandlers } from '../hooks/useCanvasHandlers'
import type { ViewportConfig } from '../types'

type Options = {
  shortcutsProp?: Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])
  tool: string
  viewport: Viewport
  viewportConfig?: ViewportConfig
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: string) => void
}

export const useWhiteboardLifecycle = ({
  shortcutsProp,
  tool,
  viewport,
  viewportConfig,
  onSelectionChange,
  onEdgeSelectionChange
}: Options) => {
  const instance = useInstance()
  const selection = useSelection()
  const { core, docRef, containerRef, shortcutManager } = instance
  const { handlers, onWheel } = useCanvasHandlers({ tool, viewport, viewportConfig })
  useSpacePressedLifecycle()
  useInstanceCommands()
  useShortcutRegistry({
    core,
    docRef,
    defaultGroupPadding: DEFAULT_GROUP_PADDING,
    shortcutsProp,
    shortcutManager
  })
  useShortcutStateSync({ tool, viewport })
  useSelectionNotifications(selection.selectedNodeIds, onSelectionChange)
  useEdgeSelectionNotifications(selection.selectedEdgeId, onEdgeSelectionChange)
  useCanvasEventBindings({ containerRef, handlers, onWheel })

  useEffect(() => {
    return () => {
      selection.cancelPendingRaf()
    }
  }, [selection])
}
