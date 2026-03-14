import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import type { CSSProperties } from 'react'
import { createDefaultNodeRegistry } from './node/registry'
import type { WhiteboardProps } from 'types/common'
import { engine, type Instance as EngineInstance } from '@whiteboard/engine'
import { normalizeConfig, toEngineInstanceConfig } from './config'
import { InstanceProvider } from './common/hooks/useInstance'
import { useTransientReset } from './common/hooks'
import {
  DEFAULT_VIEWPORT,
  useViewportController,
  useViewportTransformStyle
} from './viewport'
import { InputFeature } from './input/InputFeature'
import { SceneFeature } from './scene/SceneFeature'
import { ViewportOverlayFeature } from './overlay/ViewportOverlayFeature'
import { RootOverlayFeature } from './overlay/RootOverlayFeature'
import { SurfaceFeature } from './surface/SurfaceFeature'
import { useNodeInteractions } from './node/hooks/useNodeInteractions'
import { useNodeSizeObserver } from './node/hooks/useNodeSizeObserver'
import { useMindmapDrag } from './mindmap/hooks/drag/useMindmapDrag'
import {
  createWhiteboardUiStore,
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
  && outbound.meta === inbound.meta
)

type WhiteboardCanvasProps = {
  resolvedConfig: ReturnType<typeof normalizeConfig>
  containerRef: {
    current: HTMLDivElement | null
  }
  containerStyle: CSSProperties
}

const WhiteboardCanvas = ({
  resolvedConfig,
  containerRef,
  containerStyle
}: WhiteboardCanvasProps) => {
  const transformStyle = useViewportTransformStyle()
  const registerMeasuredElement = useNodeSizeObserver()
  const {
    cancelNodeInteractionSession,
    handleNodeDoubleClick,
    handleNodePointerDown,
    handleTransformPointerDown
  } = useNodeInteractions()
  const {
    cancelMindmapDragSession,
    handleMindmapNodePointerDown
  } = useMindmapDrag()

  useTransientReset(cancelNodeInteractionSession)
  useTransientReset(cancelMindmapDragSession)

  return (
    <div
      ref={containerRef}
      className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
      style={containerStyle}
      tabIndex={0}
    >
      <InputFeature
        containerRef={containerRef}
        shortcuts={resolvedConfig.shortcuts}
      />
      <div className="wb-root-viewport" style={transformStyle}>
        <SceneFeature
          registerMeasuredElement={registerMeasuredElement}
          onNodePointerDown={handleNodePointerDown}
          onNodeDoubleClick={handleNodeDoubleClick}
          onMindmapNodePointerDown={handleMindmapNodePointerDown}
        />
        <ViewportOverlayFeature
          onTransformPointerDown={handleTransformPointerDown}
        />
      </div>
      <RootOverlayFeature />
      <SurfaceFeature containerRef={containerRef} />
    </div>
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
  const initialViewportRef = useRef(resolvedConfig.viewport.initial ?? DEFAULT_VIEWPORT)
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
  const instanceConfig = useMemo(
    () => toEngineInstanceConfig(resolvedConfig),
    [resolvedConfig]
  )
  const uiStore = useMemo(
    () => createWhiteboardUiStore({ initialViewport: initialViewportRef.current }),
    []
  )
  const viewport = useViewportController({
    uiStore,
    containerRef,
    options: viewportPolicy
  })
  onDocChangeRef.current = onDocChange

  const engineInstanceRef = useRef<EngineInstance | null>(null)
  if (!engineInstanceRef.current) {
    engineInstanceRef.current = engine({
      registries,
      document: initialDocRef.current,
      onDocumentChange: (next) => {
        lastOutboundDocRef.current = next
        onDocChangeRef.current((draft) => {
          replaceDocumentDraft(draft, next)
        })
      },
      config: instanceConfig
    })
  }
  const engineInstance = engineInstanceRef.current!

  const instanceRef = useRef<InternalWhiteboardInstance | null>(null)
  if (!instanceRef.current) {
    instanceRef.current = createWhiteboardInstance({
      engine: engineInstance,
      uiStore,
      viewport,
      registry
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

  useEffect(() => {
    return () => {
      instance.dispose()
    }
  }, [instance])

  useEffect(() => {
    instance.configure(runtimeConfig)
  }, [instance, runtimeConfig])

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      ...(resolvedConfig.style as CSSProperties | undefined)
    }),
    [resolvedConfig.style]
  )

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
