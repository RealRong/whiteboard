import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import type { CSSProperties } from 'react'
import { Provider as JotaiProvider } from 'jotai'
import { createStore } from 'jotai/vanilla'
import { DragGuidesLayer, NodeLayer, SelectionLayer } from './node/components'
import { EdgeLayerStack } from './edge/components'
import { createDefaultNodeRegistry, NodeRegistryProvider } from './node/registry'
import type { WhiteboardProps } from 'types/common'
import { engine, type Instance as EngineInstance } from '@whiteboard/engine'
import { normalizeConfig, toEngineInstanceConfig } from './config'
import { MindmapLayerStack } from './mindmap/components'
import { InstanceProvider } from './common/hooks/useInstance'
import { useWhiteboardSelector } from './common/hooks'
import { CanvasInteractionLayer } from './common/interaction/CanvasInteractionLayer'
import { useShortcutDispatch } from './common/interaction/useShortcutDispatch'
import { useViewportGestureSelector } from './common/interaction/viewportGestureState'
import {
  createWhiteboardInstance,
  type InternalWhiteboardInstance,
  type WhiteboardInstance,
  type WhiteboardRuntimeConfig
} from './common/instance'

const replaceDocumentDraft = (draft: Document, next: Document) => {
  draft.id = next.id
  draft.name = next.name
  draft.nodes = next.nodes
  draft.edges = next.edges
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
  instance: InternalWhiteboardInstance
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
  const viewport = useWhiteboardSelector('viewport')
  const previewViewport = useViewportGestureSelector((snapshot) => snapshot.preview)
  const resolvedViewport = previewViewport ?? viewport
  const resolvedViewportTransform = useMemo(
    () => toViewportTransform(resolvedViewport),
    [resolvedViewport]
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
          style={transformStyle}
        >
          <NodeLayer />
          <EdgeLayerStack />
          <MindmapLayerStack />
          <SelectionLayer />
          <DragGuidesLayer />
        </CanvasInteractionLayer>
      </div>
    </NodeRegistryProvider>
  )
}

const WhiteboardInner = forwardRef<WhiteboardInstance | null, WhiteboardProps>(function WhiteboardInner(
  {
    doc,
    onDocChange,
    registries,
    nodeRegistry,
    config
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const initialDocRef = useRef<Document>(doc)
  const onDocChangeRef = useRef(onDocChange)
  const lastOutboundDocRef = useRef<Document>(doc)
  const registry = useMemo(
    () => nodeRegistry ?? createDefaultNodeRegistry(),
    [nodeRegistry]
  )
  const resolvedConfig = useMemo(
    () => normalizeConfig(config),
    [config]
  )
  const instanceConfig = useMemo(
    () => toEngineInstanceConfig(resolvedConfig),
    [resolvedConfig]
  )
  const uiStore = useMemo(
    () => createStore(),
    []
  )
  onDocChangeRef.current = onDocChange

  const engineInstance = useMemo<EngineInstance>(
    () => engine({
      registries,
      document: initialDocRef.current,
      onDocumentChange: (next) => {
        lastOutboundDocRef.current = next
        onDocChangeRef.current((draft) => {
          replaceDocumentDraft(draft, next)
        })
      },
      config: instanceConfig
    }),
    [instanceConfig, registries]
  )
  const instance = useMemo<InternalWhiteboardInstance>(
    () => createWhiteboardInstance({
      engine: engineInstance,
      uiStore,
      initialTool: resolvedConfig.tool
    }),
    [engineInstance, uiStore]
  )

  useImperativeHandle(ref, () => instance, [instance])

  useEffect(() => {
    if (isMirroredDocumentFromEngine(lastOutboundDocRef.current, doc)) {
      return
    }
    lastOutboundDocRef.current = doc
    void instance.commands.doc.load(doc)
  }, [doc, instance])

  const runtimeConfig = useMemo<WhiteboardRuntimeConfig>(
    () => ({
      tool: resolvedConfig.tool,
      mindmapLayout: resolvedConfig.mindmapLayout,
      history: resolvedConfig.history
    }),
    [
      resolvedConfig.history.enabled,
      resolvedConfig.history.capacity,
      resolvedConfig.history.captureSystem,
      resolvedConfig.history.captureRemote,
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
    runtime.configure(runtimeConfig)
  }, [runtime, runtimeConfig])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const emitRect = (rect: { left: number; top: number; width: number; height: number }) => {
      instance.runtime.viewport.setContainerRect(rect)
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
      <JotaiProvider store={uiStore}>
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
