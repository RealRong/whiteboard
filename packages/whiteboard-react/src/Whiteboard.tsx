import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import type { CSSProperties } from 'react'
import { createDefaultNodeRegistry } from './features/node/registry'
import type { BoardProps } from './types/common'
import { createEngine, type EngineInstance } from '@whiteboard/engine'
import { normalizeConfig, toBoardConfig } from './config'
import { InstanceProvider } from './runtime/hooks/useInstance'
import {
  DEFAULT_VIEWPORT,
  type ViewportController,
  useViewportController,
  useViewportTransformStyle
} from './runtime/viewport'
import { SelectionBoxOverlay } from './ui/canvas/selection/SelectionBoxOverlay'
import { CanvasChrome } from './ui/canvas/chrome/CanvasChrome'
import { useContextMenuSession } from './ui/context-menu/useContextMenuSession'
import { ShortcutInput } from './ui/canvas/input/ShortcutInput'
import { ContextMenuInput } from './ui/canvas/input/ContextMenuInput'
import { useEdgeConnect } from './features/edge/hooks/connect/useEdgeConnect'
import { NodeSceneLayer } from './features/node/components/NodeSceneLayer'
import { EdgeLayer } from './features/edge/components/EdgeLayer'
import { MindmapSceneLayer } from './features/mindmap/components/MindmapSceneLayer'
import { NodeOverlayLayer } from './features/node/components/NodeOverlayLayer'
import { EdgeOverlayLayer } from './features/edge/components/EdgeOverlayLayer'
import { createInteractionCoordinator } from './runtime/interaction'
import {
  createInstance,
  type BoardInstance,
  type InternalInstance
} from './runtime/instance'

const isMirroredDocumentFromEngine = (
  outbound: Document,
  inbound: Document
) => (
  outbound.id === inbound.id
  && outbound.name === inbound.name
  && outbound.nodes === inbound.nodes
  && outbound.edges === inbound.edges
  && outbound.background === inbound.background
  && outbound.meta === inbound.meta
)

type CanvasProps = {
  resolvedConfig: ReturnType<typeof normalizeConfig>
  containerRef: {
    current: HTMLDivElement | null
  }
  containerStyle?: CSSProperties
}

const WhiteboardCanvas = ({
  resolvedConfig,
  containerRef,
  containerStyle
}: CanvasProps) => {
  const transformStyle = useViewportTransformStyle()
  const contextMenu = useContextMenuSession()

  useEdgeConnect({
    containerRef
  })

  return (
    <div
      ref={containerRef}
      className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
      style={containerStyle}
      tabIndex={0}
    >
      <ShortcutInput
        containerRef={containerRef}
        shortcuts={resolvedConfig.shortcuts}
      />
      <ContextMenuInput
        containerRef={containerRef}
        onOpenContextMenu={contextMenu.open}
      />
      <div className="wb-root-viewport" style={transformStyle}>
        <NodeSceneLayer />
        <EdgeLayer />
        <MindmapSceneLayer />
        <NodeOverlayLayer />
        <EdgeOverlayLayer />
      </div>
      <SelectionBoxOverlay containerRef={containerRef} />
      <CanvasChrome
        containerRef={containerRef}
        contextMenuSession={contextMenu.session}
        closeContextMenu={contextMenu.close}
      />
    </div>
  )
}

const WhiteboardInner = forwardRef<BoardInstance | null, BoardProps>(function WhiteboardInner(
  {
    doc,
    onDocumentChange,
    registries,
    nodeRegistry,
    config
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<ViewportController | null>(null)
  const onDocumentChangeRef = useRef(onDocumentChange)
  const lastOutboundDocRef = useRef<Document>(doc)
  const interactionRef = useRef(createInteractionCoordinator({
    getViewport: () => viewportRef.current
  }))
  const resolvedConfig = useMemo(
    () => normalizeConfig(config),
    [config]
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
  const viewport = useViewportController({
    initialViewport: resolvedConfig.viewport.initial ?? DEFAULT_VIEWPORT,
    interaction: interactionRef.current,
    containerRef,
    options: viewportPolicy
  })
  viewportRef.current = viewport
  onDocumentChangeRef.current = onDocumentChange

  const engineInstanceRef = useRef<EngineInstance | null>(null)
  if (!engineInstanceRef.current) {
    engineInstanceRef.current = createEngine({
      registries,
      document: doc,
      onDocumentChange: (next) => {
        lastOutboundDocRef.current = next
        onDocumentChangeRef.current(next)
      },
      config: toBoardConfig(resolvedConfig)
    })
  }
  const engineInstance = engineInstanceRef.current!

  const instanceRef = useRef<InternalInstance | null>(null)
  if (!instanceRef.current) {
    instanceRef.current = createInstance({
      engine: engineInstance,
      initialTool: resolvedConfig.tool,
      viewport,
      registry: nodeRegistry ?? createDefaultNodeRegistry(),
      interaction: interactionRef.current
    })
  }
  const instance = instanceRef.current!

  useImperativeHandle(ref, () => instance, [instance])

  useEffect(() => {
    if (isMirroredDocumentFromEngine(lastOutboundDocRef.current, doc)) {
      return
    }
    lastOutboundDocRef.current = doc
    void instance.commands.document.replace(doc)
  }, [doc, instance])

  const runtimeConfig = useMemo(
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

  useEffect(() => {
    return () => {
      instance.dispose()
    }
  }, [instance])

  useEffect(() => {
    instance.configure(runtimeConfig)
  }, [instance, runtimeConfig])

  const containerStyle = resolvedConfig.style as CSSProperties | undefined

  return (
    <InstanceProvider value={instance}>
      <WhiteboardCanvas
        resolvedConfig={resolvedConfig}
        containerRef={containerRef}
        containerStyle={containerStyle}
      />
    </InstanceProvider>
  )
})

export const Whiteboard = WhiteboardInner
