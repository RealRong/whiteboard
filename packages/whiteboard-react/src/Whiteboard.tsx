import { useMemo, useRef } from 'react'
import { useHydrateAtoms } from 'jotai/utils'
import { DragGuidesLayer, NodeLayerStack, SelectionLayer } from './node/components'
import { EdgeLayerStack } from './edge/components'
import {
  useCanvasStyle,
  useCore,
  useResolvedNodeRegistry,
  useViewport
} from './common/hooks'
import { useWhiteboardLifecycle } from './common/lifecycle'
import { NodeRegistryProvider } from './node/registry'
import type { WhiteboardProps } from './types'
import { DEFAULT_MINDMAP_NODE_SIZE, DEFAULT_NODE_SIZE } from './common/utils/geometry'
import { docAtom, instanceAtom } from './common/state'
import { createWhiteboardInstance } from './common/instance'
import { MindmapLayerStack } from './mindmap/components'

const WhiteboardInner = ({ doc, onDocChange, core: externalCore, nodeRegistry, config }: WhiteboardProps) => {
  const resolvedConfig = {
    className: config?.className,
    style: config?.style,
    nodeSize: config?.nodeSize ?? DEFAULT_NODE_SIZE,
    mindmapNodeSize: config?.mindmapNodeSize ?? DEFAULT_MINDMAP_NODE_SIZE,
    mindmapLayout: config?.mindmapLayout ?? {},
    viewport: config?.viewport ?? {},
    tool: config?.tool ?? 'select',
    shortcuts: config?.shortcuts,
    onSelectionChange: config?.onSelectionChange,
    onEdgeSelectionChange: config?.onEdgeSelectionChange
  }
  const { core, docRef } = useCore({ doc, onDocChange, core: externalCore })
  const registry = useResolvedNodeRegistry(nodeRegistry)
  const containerRef = useRef<HTMLDivElement>(null)
  const instance = useMemo(
    () =>
      createWhiteboardInstance({
        core,
        docRef,
        containerRef,
        config: {
          nodeSize: resolvedConfig.nodeSize,
          mindmapNodeSize: resolvedConfig.mindmapNodeSize
        }
      }),
    [core, docRef, resolvedConfig.mindmapNodeSize, resolvedConfig.nodeSize]
  )
  const { viewport, transformStyle } = useViewport({
    viewport: doc.viewport,
    containerRef,
    instance
  })
  useHydrateAtoms([
    [docAtom, doc],
    [instanceAtom, instance]
  ])

  const containerStyle = useCanvasStyle(resolvedConfig.style)

  useWhiteboardLifecycle({
    shortcutsProp: resolvedConfig.shortcuts,
    tool: resolvedConfig.tool,
    viewport,
    viewportConfig: resolvedConfig.viewport,
    onSelectionChange: resolvedConfig.onSelectionChange,
    onEdgeSelectionChange: resolvedConfig.onEdgeSelectionChange
  })

  return (
    <NodeRegistryProvider registry={registry}>
      <div
        ref={containerRef}
        className={resolvedConfig.className}
        style={containerStyle}
        tabIndex={0}
      >
        <div style={{ position: 'absolute', inset: 0, ...transformStyle }}>
          <EdgeLayerStack />
          <MindmapLayerStack layout={resolvedConfig.mindmapLayout} />
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
