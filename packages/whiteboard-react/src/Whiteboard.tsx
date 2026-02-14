import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { createCore, type Core, type Document } from '@whiteboard/core'
import type { CSSProperties } from 'react'
import { DragGuidesLayer, NodeLayer, SelectionLayer } from './node/components'
import { EdgeLayerStack } from './edge/components'
import { useWhiteboardEngineBridge } from './common/lifecycle'
import { createDefaultNodeRegistry, NodeRegistryProvider } from './node/registry'
import type { WhiteboardProps } from 'types/common'
import {
  DEFAULT_DOCUMENT_VIEWPORT,
  createWhiteboardEngine,
  normalizeWhiteboardConfig,
  toWhiteboardInstanceConfig,
  type WhiteboardInstance
} from '@whiteboard/engine'
import { MindmapLayerStack } from './mindmap/components'

const cloneValue = <T,>(value: T): T => {
  const structuredCloneFn = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (structuredCloneFn) {
    return structuredCloneFn(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const cloneDocument = (document: Document): Document => cloneValue(document)

const replaceDocumentDraft = (draft: Document, next: Document) => {
  draft.id = next.id
  draft.name = next.name
  draft.nodes = next.nodes
  draft.edges = next.edges
  draft.mindmaps = next.mindmaps ?? []
  draft.order = next.order
  draft.background = next.background
  draft.viewport = next.viewport
  draft.meta = next.meta
}

const WhiteboardInner = forwardRef<WhiteboardInstance | null, WhiteboardProps>(function WhiteboardInner(
  { doc, onDocChange, core: externalCore, nodeRegistry, config },
  ref
) {
  const resolvedConfig = useMemo(() => normalizeWhiteboardConfig(config), [config])

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
        apply: (recipe) => {
          const nextDoc = cloneDocument(docRef.current)
          recipe(nextDoc)
          docRef.current = nextDoc

          onDocChangeRef.current((draft) => {
            replaceDocumentDraft(draft, nextDoc)
          })
        }
      })
  }
  if (externalCore && coreRef.current !== externalCore) {
    coreRef.current = externalCore
  }

  const core = coreRef.current as Core
  const registry = useMemo(() => nodeRegistry ?? createDefaultNodeRegistry(), [nodeRegistry])
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceConfig = useMemo(
    () => toWhiteboardInstanceConfig(resolvedConfig),
    [
      resolvedConfig.nodeSize.width,
      resolvedConfig.nodeSize.height,
      resolvedConfig.mindmapNodeSize.width,
      resolvedConfig.mindmapNodeSize.height,
      resolvedConfig.node.groupPadding,
      resolvedConfig.node.snapThresholdScreen,
      resolvedConfig.node.snapMaxThresholdWorld,
      resolvedConfig.node.snapGridCellSize,
      resolvedConfig.node.selectionMinDragDistance,
      resolvedConfig.edge.hitTestThresholdScreen,
      resolvedConfig.edge.anchorSnapMin,
      resolvedConfig.edge.anchorSnapRatio,
      resolvedConfig.viewport.wheelSensitivity
    ]
  )
  const instance = useMemo(
    () =>
      createWhiteboardEngine({
        core,
        docRef,
        containerRef,
        config: instanceConfig
      }),
    [core, docRef, instanceConfig]
  )

  useImperativeHandle(ref, () => instance, [instance])
  useWhiteboardEngineBridge({
    doc,
    instance,
    historyConfig: resolvedConfig.history,
    viewport: doc.viewport,
    shortcutsProp: resolvedConfig.shortcuts,
    tool: resolvedConfig.tool,
    viewportConfig: resolvedConfig.viewport,
    onSelectionChange: resolvedConfig.onSelectionChange,
    onEdgeSelectionChange: resolvedConfig.onEdgeSelectionChange
  })

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      ...(resolvedConfig.style as CSSProperties | undefined)
    }),
    [resolvedConfig.style]
  )

  const viewport = doc.viewport ?? DEFAULT_DOCUMENT_VIEWPORT
  const transformStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate(50%, 50%) scale(${viewport.zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
      transformOrigin: '0 0',
      ['--wb-zoom' as const]: `${viewport.zoom}`
    }),
    [viewport.center.x, viewport.center.y, viewport.zoom]
  )

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
})

export const Whiteboard = WhiteboardInner
