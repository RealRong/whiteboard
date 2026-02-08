import { useEffect } from 'react'
import type { NodeId } from '@whiteboard/core'
import type { Shortcut } from 'types/shortcuts'
import { useCanvasEventBindings } from './useCanvasEventBindings'
import { useEdgeSelectionNotifications } from './useEdgeSelectionNotifications'
import { useSelectionNotifications } from './useSelectionNotifications'
import { useSpacePressedLifecycle } from './useSpacePressedLifecycle'
import { useTransientLifecycle } from './useTransientLifecycle'
import { useShortcutRegistry } from '../shortcuts/lifecycle/useShortcutRegistry'
import { useSelectionRuntime, useSelectionState } from '../../node/hooks'
import { useInstance } from '../hooks/useInstance'
import { useToolLifecycle } from './useToolLifecycle'
import { DEFAULT_GROUP_PADDING } from '../../node/constants'
import { useCanvasHandlers } from '../hooks/internal/useCanvasHandlers'
import type { ViewportConfig } from 'types/common'
import { useNodeLifecycle } from '../../node/lifecycle'
import { useEdgeLifecycle } from '../../edge/lifecycle'

type Options = {
  shortcutsProp?: Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])
  tool: string
  viewportConfig?: ViewportConfig
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: string) => void
}

export const useWhiteboardLifecycle = ({
  shortcutsProp,
  tool,
  viewportConfig,
  onSelectionChange,
  onEdgeSelectionChange
}: Options) => {
  const instance = useInstance()
  const selectionState = useSelectionState()
  const selectionRuntime = useSelectionRuntime({ enabled: false })
  const { core, docRef, containerRef, shortcuts } = instance.runtime
  const { handlers, onWheel } = useCanvasHandlers({
    tool: (tool as 'select' | 'edge') ?? 'select',
    viewportConfig
  })

  useSpacePressedLifecycle()
  useTransientLifecycle()
  useNodeLifecycle()
  useEdgeLifecycle()
  useShortcutRegistry({
    core,
    docRef,
    defaultGroupPadding: DEFAULT_GROUP_PADDING,
    shortcutsProp,
    shortcutManager: shortcuts
  })
  useToolLifecycle(tool)
  useSelectionNotifications(selectionState.selectedNodeIds, onSelectionChange)
  useEdgeSelectionNotifications(selectionState.selectedEdgeId, onEdgeSelectionChange)
  useCanvasEventBindings({ containerRef, handlers, onWheel })

  useEffect(() => {
    return () => {
      selectionRuntime.cancelPendingRaf()
      instance.runtime.services.nodeSizeObserver.dispose()
      instance.runtime.services.containerSizeObserver.dispose()
    }
  }, [instance, selectionRuntime])
}
