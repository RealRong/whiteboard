import { useMemo, useRef } from 'react'
import { createCore, type Core, type Document } from '@whiteboard/core'
import type { CSSProperties } from 'react'
import { DragGuidesLayer, NodeLayer, SelectionLayer } from './node/components'
import { EdgeLayerStack } from './edge/components'
import { useViewportRuntime } from './common/hooks'
import { useWhiteboardContextHydration, useWhiteboardLifecycle } from './common/lifecycle'
import { createDefaultNodeRegistry, NodeRegistryProvider } from './node/registry'
import type { WhiteboardProps } from 'types/common'
import { DEFAULT_MINDMAP_NODE_SIZE, DEFAULT_NODE_SIZE } from './common/utils/geometry'
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
  const docRef = useRef(doc)
  const onDocChangeRef = useRef(onDocChange)
  const coreRef = useRef<Core | null>(null)

  docRef.current = doc
  onDocChangeRef.current = onDocChange

  if (!coreRef.current) {
    coreRef.current =
      externalCore ??
      createCore({
        getState: () => docRef.current,
        apply: (recipe) => onDocChangeRef.current(recipe)
      })
  }
  if (externalCore && coreRef.current !== externalCore) {
    coreRef.current = externalCore
  }

  const core = coreRef.current as Core
  const registry = useMemo(() => nodeRegistry ?? createDefaultNodeRegistry(), [nodeRegistry])
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
  const { transformStyle } = useViewportRuntime({
    viewport: doc.viewport,
    containerRef,
    instance
  })
  useWhiteboardContextHydration(doc, instance)

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      ...resolvedConfig.style
    }),
    [resolvedConfig.style]
  )

  useWhiteboardLifecycle({
    shortcutsProp: resolvedConfig.shortcuts,
    tool: resolvedConfig.tool,
    viewportConfig: resolvedConfig.viewport,
    onSelectionChange: resolvedConfig.onSelectionChange,
    onEdgeSelectionChange: resolvedConfig.onEdgeSelectionChange
  })

  return (
    <NodeRegistryProvider registry={registry}>
      <div
        ref={containerRef}
        className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
        style={containerStyle}
        tabIndex={0}
      >
        <div className="wb-root-viewport" style={transformStyle}>
          <EdgeLayerStack />
          <MindmapLayerStack layout={resolvedConfig.mindmapLayout} />
          <DragGuidesLayer />
          <NodeLayer />
        </div>
        <SelectionLayer />
      </div>
    </NodeRegistryProvider>
  )
}

export const Whiteboard = (props: WhiteboardProps) => {
  return <WhiteboardInner {...props} />
}
