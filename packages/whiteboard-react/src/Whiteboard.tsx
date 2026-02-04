import { useMemo, useRef } from 'react'
import { useHydrateAtoms } from 'jotai/utils'
import { SelectionLayer } from './node/components/SelectionLayer'
import { DragGuidesLayer } from './node/components/DragGuidesLayer'
import { NodeLayerStack } from './node/components/NodeLayerStack'
import { EdgeLayerStack } from './edge/components/EdgeLayerStack'
import { useCore } from './common/hooks/useCore'
import { useViewport } from './common/hooks/useViewport'
import { useViewportInteraction } from './common/hooks/useViewportInteraction'
import { useCanvasHandlers } from './common/hooks/useCanvasHandlers'
import { useCanvasStyle } from './common/hooks/useCanvasStyle'
import { useCanvasEventBindings } from './common/hooks/useCanvasEventBindings'
import { useSelectionNotifications } from './common/hooks/useSelectionNotifications'
import { useEdgeSelectionNotifications } from './common/hooks/useEdgeSelectionNotifications'
import { createShortcutManager } from './common/shortcuts/shortcutManager'
import { useShortcutRegistry } from './common/shortcuts/useShortcutRegistry'
import { useShortcutHandlers } from './common/shortcuts/useShortcutHandlers'
import { useShortcutStateSync } from './common/shortcuts/useShortcutStateSync'
import { NodeRegistryProvider } from './node/registry/nodeRegistry'
import { useResolvedNodeRegistry } from './common/hooks/useResolvedNodeRegistry'
import type { WhiteboardProps } from './types'
import { DEFAULT_MINDMAP_NODE_SIZE, DEFAULT_NODE_SIZE } from './common/utils/geometry'
import { DEFAULT_GROUP_PADDING } from './node/constants'
import {
  whiteboardInputAtom,
  mindmapNodeSizeAtom,
  nodeSizeAtom
} from './common/state/whiteboardInputAtoms'
import { createWhiteboardInstance } from './common/instance/whiteboardInstance'
import { useSelectionStore } from './common/hooks/useSelectionStore'
import { useShortcutContextValue } from './common/hooks/useShortcutContextValue'
import { useInteractionActions } from './common/hooks/useInteractionActions'

const WhiteboardInner = ({
  doc,
  onDocChange,
  core: externalCore,
  nodeRegistry,
  onSelectionChange,
  onEdgeSelectionChange,
  className,
  style,
  nodeSize = DEFAULT_NODE_SIZE,
  mindmapNodeSize = DEFAULT_MINDMAP_NODE_SIZE,
  mindmapLayout = {},
  viewport: viewportConfig = {},
  tool = 'select',
  shortcuts: shortcutsProp
}: WhiteboardProps) => {
  const { core, docRef } = useCore({ doc, onDocChange, core: externalCore })
  const registry = useResolvedNodeRegistry(nodeRegistry)
  const containerRef = useRef<HTMLDivElement>(null)
  const { viewport, transformStyle, screenToWorld } = useViewport(doc.viewport, containerRef)
  const selectionState = useSelectionStore()
  const instance = useMemo(
    () => createWhiteboardInstance({ core, docRef, containerRef }),
    [core, docRef]
  )
  const inputState = useMemo(
    () => ({
      doc,
      docRef,
      core,
      containerRef,
      screenToWorld,
      mindmapLayout,
      instance
    }),
    [containerRef, core, doc, docRef, instance, mindmapLayout, screenToWorld]
  )

  useHydrateAtoms([
    [whiteboardInputAtom, inputState],
    [nodeSizeAtom, nodeSize],
    [mindmapNodeSizeAtom, mindmapNodeSize]
  ])

  const shortcutManager = useMemo(() => createShortcutManager(), [])
  useShortcutRegistry({
    core,
    docRef,
    defaultGroupPadding: DEFAULT_GROUP_PADDING,
    shortcutsProp,
    shortcutManager
  })

  useShortcutStateSync({ tool, viewport })

  const shortcutContext = useShortcutContextValue()
  const { updateInteraction } = useInteractionActions()
  const { handlePointerDownCapture: handleShortcutPointerDownCapture, handleKeyDown: handleShortcutKeyDown } =
    useShortcutHandlers({ shortcutManager, shortcutContext, updateInteraction })
  useSelectionNotifications(selectionState.selectedNodeIds, onSelectionChange)
  useEdgeSelectionNotifications(selectionState.selectedEdgeId, onEdgeSelectionChange)

  const { viewportHandlers, onWheel } = useViewportInteraction({
    core,
    viewport,
    screenToWorld,
    containerRef,
    config: viewportConfig
  })
  const containerStyle = useCanvasStyle(style)

  const {
    handlePointerDown,
    handlePointerDownCapture,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown
  } = useCanvasHandlers({
    containerRef,
    viewportHandlers,
    screenToWorld,
    tool,
    onShortcutPointerDownCapture: handleShortcutPointerDownCapture,
    onShortcutKeyDown: handleShortcutKeyDown
  })

  useCanvasEventBindings({
    containerRef,
    handlers: {
      handlePointerDown,
      handlePointerDownCapture,
      handlePointerMove,
      handlePointerUp,
      handleKeyDown
    },
    onWheel
  })

  return (
    <NodeRegistryProvider registry={registry}>
      <div
        ref={containerRef}
        className={className}
        style={containerStyle}
        tabIndex={0}
      >
        <div style={{ position: 'absolute', inset: 0, ...transformStyle }}>
          <EdgeLayerStack />
          <DragGuidesLayer />
          <NodeLayerStack />
        </div>
        <SelectionLayer />
      </div>
    </NodeRegistryProvider>
  )
}

export const Whiteboard = (props: WhiteboardProps) => {
  return <WhiteboardInner {...props} />
}
