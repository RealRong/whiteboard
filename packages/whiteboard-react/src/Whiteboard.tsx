import { RefObject, useMemo, useRef } from 'react'
import { useHydrateAtoms } from 'jotai/utils'
import { DragGuidesLayer, NodeLayerStack, SelectionLayer } from './node/components'
import { EdgeLayerStack } from './edge/components'
import {
  useCanvasStyle,
  useCore,
  useResolvedNodeRegistry,
  useViewport
} from './common/hooks'
import { useViewportSize, useWhiteboardLifecycle } from './common/lifecycle'
import { NodeRegistryProvider } from './node/registry'
import type { WhiteboardProps } from './types'
import { DEFAULT_MINDMAP_NODE_SIZE, DEFAULT_NODE_SIZE } from './common/utils/geometry'
import { mindmapNodeSizeAtom, nodeSizeAtom, whiteboardInputAtom } from './common/state'
import { createWhiteboardInstance } from './common/instance'

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
  const containerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>
  const containerSize = useViewportSize(containerRef)
  const { viewport, transformStyle, screenToWorld } = useViewport(doc.viewport, containerSize)
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

  const containerStyle = useCanvasStyle(style)

  useWhiteboardLifecycle({
    shortcutsProp,
    tool,
    viewport,
    viewportConfig,
    onSelectionChange,
    onEdgeSelectionChange
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
