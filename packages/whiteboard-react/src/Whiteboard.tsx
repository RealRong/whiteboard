import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import type { CSSProperties } from 'react'
import { Provider as JotaiProvider } from 'jotai'
import { DragGuidesLayer, NodeLayer, SelectionLayer } from './node/components'
import { EdgeLayerStack } from './edge/components'
import { createDefaultNodeRegistry, NodeRegistryProvider } from './node/registry'
import type { WhiteboardProps } from 'types/common'
import {
  engine,
  normalizeConfig,
  toApplyConfig,
  toInstanceConfig,
  READ_STATE_KEYS,
  type Instance
} from '@whiteboard/engine'
import { MindmapLayerStack } from './mindmap/components'
import { InstanceProvider } from './common/hooks/useInstance'
import { useReadGetter } from './common/hooks'
import { CanvasInteractionLayer } from './common/interaction/CanvasInteractionLayer'
import { useShortcutDispatch } from './common/interaction/useShortcutDispatch'
import { useViewportGestureSelector } from './common/interaction/viewportGestureState'

const replaceDocumentDraft = (draft: Document, next: Document) => {
  draft.id = next.id
  draft.name = next.name
  draft.nodes = next.nodes
  draft.edges = next.edges
  draft.order = next.order
  draft.background = next.background
  draft.viewport = next.viewport
  draft.meta = next.meta
}

const isMirroredDocumentFromEngine = (
  outbound: Document,
  inbound: Document
) => (
  outbound.id === inbound.id
  && outbound.name === inbound.name
  && outbound.nodes === inbound.nodes
  && outbound.edges === inbound.edges
  && outbound.order === inbound.order
  && outbound.background === inbound.background
  && outbound.viewport === inbound.viewport
  && outbound.meta === inbound.meta
)

const toViewportTransform = (viewport: {
  center: {
    x: number
    y: number
  }
  zoom: number
}) => {
  const zoom = viewport.zoom
  return {
    center: viewport.center,
    zoom,
    transform: `translate(50%, 50%) scale(${zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
    cssVars: {
      '--wb-zoom': `${zoom}`
    }
  }
}

type WhiteboardCanvasProps = {
  instance: Instance
  registry: ReturnType<typeof createDefaultNodeRegistry>
  resolvedConfig: ReturnType<typeof normalizeConfig>
  containerRef: {
    current: HTMLDivElement | null
  }
  containerStyle: CSSProperties
  viewportPolicy: {
    panEnabled: boolean
    wheelEnabled: boolean
    minZoom: number
    maxZoom: number
    wheelSensitivity: number
  }
}

const WhiteboardCanvas = ({
  instance,
  registry,
  resolvedConfig,
  containerRef,
  containerStyle,
  viewportPolicy
}: WhiteboardCanvasProps) => {
  const viewportTransform = useReadGetter(
    () => instance.read.projection.viewportTransform,
    { keys: [READ_STATE_KEYS.viewport] }
  )
  const previewViewport = useViewportGestureSelector((snapshot) => snapshot.preview)
  const resolvedViewportTransform = useMemo(
    () => (previewViewport ? toViewportTransform(previewViewport) : viewportTransform),
    [previewViewport, viewportTransform]
  )
  const transformStyle = useMemo<CSSProperties>(
    () => ({
      transform: resolvedViewportTransform.transform,
      transformOrigin: '0 0',
      ...resolvedViewportTransform.cssVars
    }),
    [resolvedViewportTransform]
  )
  useShortcutDispatch({
    instance,
    containerRef,
    shortcuts: resolvedConfig.shortcuts
  })

  return (
    <NodeRegistryProvider registry={registry}>
      <div
        ref={containerRef}
        className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
        style={containerStyle}
        tabIndex={0}
      >
        <CanvasInteractionLayer
          instance={instance}
          viewportPolicy={viewportPolicy}
          getContainer={() => containerRef.current}
          className="wb-root-viewport"
          style={transformStyle}
        >
          <EdgeLayerStack />
          <MindmapLayerStack />
          <DragGuidesLayer />
          <NodeLayer />
        </CanvasInteractionLayer>
        <SelectionLayer />
      </div>
    </NodeRegistryProvider>
  )
}

const WhiteboardInner = forwardRef<Instance | null, WhiteboardProps>(function WhiteboardInner(
  { doc, onDocChange, registries, nodeRegistry, config },
  ref
) {
  const resolvedConfig = useMemo(() => normalizeConfig(config), [config])

  const initialDocRef = useRef(doc)
  const onDocChangeRef = useRef(onDocChange)
  const lastOutboundDocRef = useRef(initialDocRef.current)

  onDocChangeRef.current = onDocChange
  const registry = useMemo(() => nodeRegistry ?? createDefaultNodeRegistry(), [nodeRegistry])
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceConfig = useMemo(
    () => toInstanceConfig(resolvedConfig),
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
      engine({
        registries,
        document: initialDocRef.current,
        onDocumentChange: (nextDoc) => {
          lastOutboundDocRef.current = nextDoc
          onDocChangeRef.current((draft) => {
            replaceDocumentDraft(draft, nextDoc)
          })
        },
        config: instanceConfig
      }),
    [instanceConfig, registries]
  )

  useImperativeHandle(ref, () => instance, [instance])

  useEffect(() => {
    if (isMirroredDocumentFromEngine(lastOutboundDocRef.current, doc)) {
      return
    }
    lastOutboundDocRef.current = doc
    void instance.commands.doc.load(doc)
  }, [doc, instance])

  const runtimeConfig = useMemo(
    () =>
      toApplyConfig({
        tool: resolvedConfig.tool,
        mindmapLayout: resolvedConfig.mindmapLayout,
        viewport: doc.viewport,
        history: resolvedConfig.history
      }),
    [
      resolvedConfig.history.enabled,
      resolvedConfig.history.capacity,
      resolvedConfig.history.captureSystem,
      resolvedConfig.history.captureRemote,
      doc.viewport?.center?.x,
      doc.viewport?.center?.y,
      doc.viewport?.zoom,
      resolvedConfig.tool,
      resolvedConfig.mindmapLayout.mode,
      resolvedConfig.mindmapLayout.options?.hGap,
      resolvedConfig.mindmapLayout.options?.vGap,
      resolvedConfig.mindmapLayout.options?.side
    ]
  )

  const runtime = instance.runtime
  useEffect(() => {
    return () => {
      runtime.dispose()
    }
  }, [runtime])

  useEffect(() => {
    runtime.applyConfig(runtimeConfig)
  }, [runtime, runtimeConfig])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const emitRect = (rect: { left: number; top: number; width: number; height: number }) => {
      instance.commands.host.containerResized(rect)
    }

    const initial = container.getBoundingClientRect()
    emitRect({
      left: initial.left,
      top: initial.top,
      width: initial.width,
      height: initial.height
    })

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const next = container.getBoundingClientRect()
      emitRect({
        left: next.left,
        top: next.top,
        width: next.width,
        height: next.height
      })
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
    }
  }, [instance])

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      ...(resolvedConfig.style as CSSProperties | undefined)
    }),
    [resolvedConfig.style]
  )
  const viewportPolicy = useMemo(
    () => ({
      panEnabled: resolvedConfig.viewport.enablePan,
      wheelEnabled: resolvedConfig.viewport.enableWheel,
      minZoom: resolvedConfig.viewport.minZoom,
      maxZoom: resolvedConfig.viewport.maxZoom,
      wheelSensitivity: resolvedConfig.viewport.wheelSensitivity
    }),
    [
      resolvedConfig.viewport.enablePan,
      resolvedConfig.viewport.enableWheel,
      resolvedConfig.viewport.minZoom,
      resolvedConfig.viewport.maxZoom,
      resolvedConfig.viewport.wheelSensitivity
    ]
  )

  return (
    <InstanceProvider value={instance}>
      <JotaiProvider store={instance.runtime.store}>
        <WhiteboardCanvas
          instance={instance}
          registry={registry}
          resolvedConfig={resolvedConfig}
          containerRef={containerRef}
          containerStyle={containerStyle}
          viewportPolicy={viewportPolicy}
        />
      </JotaiProvider>
    </InstanceProvider>
  )
})

export const Whiteboard = WhiteboardInner
