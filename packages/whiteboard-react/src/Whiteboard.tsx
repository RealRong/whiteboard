import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import type { CSSProperties } from 'react'
import { createDefaultNodeRegistry } from './features/node/registry'
import type { WhiteboardProps } from './types/common'
import {
  createEngine,
  normalizeDocument,
  type EngineInstance
} from '@whiteboard/engine'
import { normalizeConfig, toBoardConfig } from './config'
import { InstanceProvider } from './runtime/hooks/useWhiteboard'
import { useInternalInstance, useStoreValue, useTool } from './runtime/hooks'
import {
  useBindViewportInput
} from './runtime/viewport'
import { CanvasBackground } from './canvas/CanvasBackground'
import { CanvasChrome } from './canvas/CanvasChrome'
import { createMarqueeSession } from './canvas/Marquee'
import { useCanvasClipboard } from './canvas/useCanvasClipboard'
import { useCanvasInsert } from './canvas/toolbar/useCanvasInsert'
import { useEdgeInput } from './features/edge/hooks/useEdgeInput'
import { DrawLayer } from './features/draw/DrawLayer'
import { createNodeGesture } from './features/node/gesture'
import { NodeSceneLayer } from './features/node/components/NodeSceneLayer'
import {
  ContainerChromeLayer,
  ContainerLayer
} from './features/node/components/ContainerLayer'
import { EdgeLayer } from './features/edge/components/EdgeLayer'
import { MindmapSceneLayer } from './features/mindmap/components/MindmapSceneLayer'
import { NodeOverlayLayer } from './features/node/components/NodeOverlayLayer'
import { EdgeOverlayLayer } from './features/edge/components/EdgeOverlayLayer'
import {
  createInstance,
  type WhiteboardInstance,
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
  const instance = useInternalInstance()
  const marqueeRef = useRef<ReturnType<typeof createMarqueeSession> | null>(null)
  const gestureRef = useRef<ReturnType<typeof createNodeGesture> | null>(null)
  const viewport = useStoreValue(instance.viewport)
  const tool = useTool()
  const inputPolicy = useMemo(
    () => ({
      panEnabled: resolvedConfig.viewport.enablePan,
      wheelEnabled: resolvedConfig.viewport.enableWheel,
      wheelSensitivity: resolvedConfig.viewport.wheelSensitivity
    }),
    [
      resolvedConfig.viewport.enablePan,
      resolvedConfig.viewport.enableWheel,
      resolvedConfig.viewport.wheelSensitivity
    ]
  )
  const transformStyle = useMemo(
    () => ({
      transform: `translate(50%, 50%) scale(${viewport.zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
      transformOrigin: '0 0',
      '--wb-zoom': `${viewport.zoom}`
    } as CSSProperties),
    [viewport]
  )

  if (!marqueeRef.current) {
    marqueeRef.current = createMarqueeSession(instance, {
      getContainerBodyPress: () => (
        gestureRef.current?.handleContainerBodyPointerDown ?? null
      )
    })
  }

  const marquee = marqueeRef.current!

  if (!gestureRef.current) {
    gestureRef.current = createNodeGesture(instance, marquee)
  }

  const gesture = gestureRef.current!

  useEffect(() => () => {
    marquee.cancel()
    gesture.cancel()
  }, [marquee, gesture])

  useCanvasInsert({
    containerRef
  })
  useCanvasClipboard({
    containerRef
  })
  useBindViewportInput({
    instance,
    containerRef,
    options: inputPolicy
  })
  const edgeInput = useEdgeInput({
    containerRef
  })

  return (
    <div
      ref={containerRef}
      className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
      data-tool={tool.type}
      data-tool-preset={tool.type === 'edge' || tool.type === 'insert' || tool.type === 'draw' ? tool.preset : undefined}
      style={containerStyle}
      tabIndex={0}
    >
      <CanvasBackground />
      <div className="wb-root-viewport" style={transformStyle}>
        <ContainerLayer />
        <EdgeLayer onEdgePointerDown={edgeInput.handleEdgePointerDown} />
        <NodeSceneLayer gesture={gesture} />
        <MindmapSceneLayer />
        <ContainerChromeLayer gesture={gesture} />
        <NodeOverlayLayer />
        <EdgeOverlayLayer
          onEndpointPointerDown={edgeInput.handleEndpointPointerDown}
          onPathPointPointerDown={edgeInput.handlePathPointPointerDown}
          onPathPointKeyDown={edgeInput.handlePathPointKeyDown}
        />
        <DrawLayer containerRef={containerRef} />
      </div>
      <CanvasChrome
        containerRef={containerRef}
        marquee={marquee}
        shortcuts={resolvedConfig.shortcuts}
      />
    </div>
  )
}

const WhiteboardInner = forwardRef<WhiteboardInstance | null, WhiteboardProps>(function WhiteboardInner(
  {
    document,
    onDocumentChange,
    coreRegistries,
    nodeRegistry,
    options
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onDocumentChangeRef = useRef(onDocumentChange)
  const resolvedConfig = useMemo(
    () => normalizeConfig(options),
    [options]
  )
  const boardConfig = useMemo(
    () => toBoardConfig(resolvedConfig),
    [resolvedConfig]
  )
  const inputDocument = useMemo(
    () => normalizeDocument(document, boardConfig),
    [document, boardConfig]
  )
  const lastOutboundDocumentRef = useRef<Document>(inputDocument)
  onDocumentChangeRef.current = onDocumentChange

  const engineInstanceRef = useRef<EngineInstance | null>(null)
  if (!engineInstanceRef.current) {
    engineInstanceRef.current = createEngine({
      registries: coreRegistries,
      document: inputDocument,
      onDocumentChange: (nextDocument) => {
        lastOutboundDocumentRef.current = nextDocument
        onDocumentChangeRef.current(nextDocument)
      },
      config: boardConfig
    })
  }
  const engineInstance = engineInstanceRef.current!

  const instanceRef = useRef<InternalInstance | null>(null)
  if (!instanceRef.current) {
    instanceRef.current = createInstance({
      engine: engineInstance,
      initialTool: resolvedConfig.tool,
      initialViewport: resolvedConfig.viewport.initial,
      viewportLimits: {
        minZoom: resolvedConfig.viewport.minZoom,
        maxZoom: resolvedConfig.viewport.maxZoom
      },
      registry: nodeRegistry ?? createDefaultNodeRegistry(),
    })
  }
  const instance = instanceRef.current!

  useImperativeHandle(ref, () => instance, [instance])

  useEffect(() => {
    if (isMirroredDocumentFromEngine(document, inputDocument)) {
      return
    }
    if (!isMirroredDocumentFromEngine(lastOutboundDocumentRef.current, inputDocument)) {
      return
    }
    onDocumentChangeRef.current(inputDocument)
  }, [document, inputDocument])

  useEffect(() => {
    if (isMirroredDocumentFromEngine(lastOutboundDocumentRef.current, inputDocument)) {
      return
    }
    lastOutboundDocumentRef.current = inputDocument
    instance.commands.document.replace(inputDocument)
  }, [inputDocument, instance])

  const runtimeConfig = useMemo(
    () => ({
      tool: resolvedConfig.tool,
      viewport: {
        minZoom: resolvedConfig.viewport.minZoom,
        maxZoom: resolvedConfig.viewport.maxZoom
      },
      mindmapLayout: resolvedConfig.mindmapLayout,
      history: resolvedConfig.history
    }),
    [
      resolvedConfig.history.enabled,
      resolvedConfig.history.capacity,
      resolvedConfig.history.captureSystem,
      resolvedConfig.history.captureRemote,
      resolvedConfig.tool,
      resolvedConfig.viewport.minZoom,
      resolvedConfig.viewport.maxZoom,
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
