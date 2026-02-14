import { useMemo } from 'react'
import type { Document, NodeId, Viewport } from '@whiteboard/core'
import type { ShortcutOverrides, WhiteboardInstance } from '@whiteboard/engine'
import type { ViewportConfig, WhiteboardResolvedHistoryConfig } from 'types/common'
import { toWhiteboardLifecycleConfig } from '@whiteboard/engine'
import { useWhiteboardContextHydration } from './useWhiteboardContextHydration'
import { useWhiteboardLifecycle } from './useWhiteboardLifecycle'

type Options = {
  doc: Document
  instance: WhiteboardInstance
  historyConfig: WhiteboardResolvedHistoryConfig
  viewport?: Viewport
  shortcutsProp?: ShortcutOverrides
  tool: 'select' | 'edge'
  viewportConfig?: ViewportConfig
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: string) => void
}

export const useWhiteboardEngineBridge = ({
  doc,
  instance,
  historyConfig,
  viewport,
  shortcutsProp,
  tool,
  viewportConfig,
  onSelectionChange,
  onEdgeSelectionChange
}: Options) => {
  useWhiteboardContextHydration(doc, instance)

  const lifecycleConfig = useMemo(
    () =>
      toWhiteboardLifecycleConfig({
        instance,
        docId: doc.id,
        tool,
        viewport,
        viewportConfig,
        history: historyConfig,
        shortcuts: shortcutsProp,
        onSelectionChange,
        onEdgeSelectionChange
      }),
    [
      doc.id,
      historyConfig.enabled,
      historyConfig.capacity,
      historyConfig.captureSystem,
      historyConfig.captureRemote,
      instance,
      onEdgeSelectionChange,
      onSelectionChange,
      viewport?.center?.x,
      viewport?.center?.y,
      viewport?.zoom,
      shortcutsProp,
      tool,
      viewportConfig?.enablePan,
      viewportConfig?.enableWheel,
      viewportConfig?.maxZoom,
      viewportConfig?.minZoom,
      viewportConfig?.wheelSensitivity
    ]
  )

  useWhiteboardLifecycle({
    instance,
    config: lifecycleConfig
  })
}
