import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import type { CSSProperties } from 'react'
import {
  createYjsSession,
  type CollabSession
} from '@whiteboard/collab'
import { createDefaultNodeRegistry } from './features/node/registry'
import type { WhiteboardProps } from './types/common'
import {
  createEngine,
  normalizeDocument,
  type EngineInstance
} from '@whiteboard/engine'
import { normalizeConfig, toBoardConfig } from './config'
import {
  InstanceProvider,
  useInternalInstance,
  useStoreValue,
  useTool
} from './runtime/hooks'
import {
  useBindViewportInput
} from './runtime/viewport'
import { CanvasBackground } from './canvas/CanvasBackground'
import { CanvasChrome } from './canvas/CanvasChrome'
import { useCanvasClipboard } from './canvas/useCanvasClipboard'
import { useCanvasDown } from './canvas/useCanvasDown'
import { DrawLayer } from './features/draw/DrawLayer'
import { NodeSceneLayer } from './features/node/components/NodeSceneLayer'
import {
  FrameLayer,
  ContainerChromeLayer,
} from './features/node/components/FrameLayer'
import { EdgeLayer } from './features/edge/components/EdgeLayer'
import { MindmapSceneLayer } from './features/mindmap/components/MindmapSceneLayer'
import { NodeOverlayLayer } from './features/node/components/NodeOverlayLayer'
import { EdgeOverlayLayer } from './features/edge/components/EdgeOverlayLayer'
import {
  createEditor,
  type Editor,
  type InternalEditor
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
  useCanvasClipboard({
    containerRef
  })
  useBindViewportInput({
    instance,
    containerRef,
    options: inputPolicy
  })
  const canvasInput = useCanvasDown({
    containerRef
  })

  return (
    <div
      ref={containerRef}
      className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
      data-tool={tool.type}
      data-tool-value={
        tool.type === 'edge' || tool.type === 'insert'
          ? tool.preset
          : tool.type === 'draw'
            ? tool.kind
            : undefined
      }
      style={containerStyle}
      tabIndex={0}
    >
      <CanvasBackground />
      <div className="wb-root-viewport" style={transformStyle}>
        <FrameLayer />
        <EdgeLayer />
        <NodeSceneLayer />
        <MindmapSceneLayer />
        <ContainerChromeLayer />
        <NodeOverlayLayer />
        <EdgeOverlayLayer
          onRoutePointKeyDown={canvasInput.edgeRouteKeyDown}
        />
        <DrawLayer preview={canvasInput.drawPreview} />
      </div>
      <CanvasChrome
        containerRef={containerRef}
        marquee={canvasInput.marquee}
        shortcuts={resolvedConfig.shortcuts}
      />
    </div>
  )
}

const WhiteboardInner = forwardRef<Editor | null, WhiteboardProps>(function WhiteboardInner(
  {
    document,
    onDocumentChange,
    coreRegistries,
    nodeRegistry,
    collab,
    options
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onDocumentChangeRef = useRef(onDocumentChange)
  const onCollabSessionRef = useRef(collab?.onSession)
  const onCollabStatusChangeRef = useRef(collab?.onStatusChange)
  const lastCollabSessionCallbackRef = useRef(collab?.onSession)
  const lastCollabStatusCallbackRef = useRef(collab?.onStatusChange)
  const collabSessionRef = useRef<CollabSession | null>(null)
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
  onCollabSessionRef.current = collab?.onSession
  onCollabStatusChangeRef.current = collab?.onStatusChange

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

  const instanceRef = useRef<InternalEditor | null>(null)
  if (!instanceRef.current) {
    instanceRef.current = createEditor({
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

  useEffect(() => {
    if (!collab) {
      return
    }

    const session = createYjsSession({
      engine: engineInstance,
      doc: collab.doc,
      provider: collab.provider,
      bootstrap: collab.bootstrap
    })
    collabSessionRef.current = session
    onCollabSessionRef.current?.(session)
    onCollabStatusChangeRef.current?.(session.status.get())

    const unsubscribeStatus = session.status.subscribe(() => {
      onCollabStatusChangeRef.current?.(session.status.get())
    })

    if (collab.autoConnect ?? true) {
      session.connect()
    }

    return () => {
      unsubscribeStatus()
      collabSessionRef.current = null
      onCollabSessionRef.current?.(null)
      session.destroy()
    }
  }, [
    collab?.autoConnect,
    collab?.bootstrap,
    collab?.doc,
    collab?.provider,
    engineInstance
  ])

  useEffect(() => {
    if (lastCollabSessionCallbackRef.current === collab?.onSession) {
      return
    }
    lastCollabSessionCallbackRef.current = collab?.onSession
    if (!collab?.onSession || !collabSessionRef.current) {
      return
    }
    collab.onSession(collabSessionRef.current)
  }, [collab?.onSession])

  useEffect(() => {
    if (lastCollabStatusCallbackRef.current === collab?.onStatusChange) {
      return
    }
    lastCollabStatusCallbackRef.current = collab?.onStatusChange
    if (!collab?.onStatusChange || !collabSessionRef.current) {
      return
    }
    collab.onStatusChange(collabSessionRef.current.status.get())
  }, [collab?.onStatusChange])

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
