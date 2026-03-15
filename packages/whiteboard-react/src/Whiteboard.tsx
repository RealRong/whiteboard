import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { createValueStore } from '@whiteboard/core/runtime'
import type { Document } from '@whiteboard/core/types'
import type { CSSProperties } from 'react'
import { createDefaultNodeRegistry } from './features/node/registry'
import type { WhiteboardProps } from 'types/common'
import { engine, type Instance as EngineInstance } from '@whiteboard/engine'
import { normalizeConfig, toEngineInstanceConfig } from './config'
import { InstanceProvider } from './runtime/hooks/useInstance'
import {
  DEFAULT_VIEWPORT,
  useViewportController,
  useViewportTransformStyle
} from './runtime/viewport'
import { InputFeature } from './ui/canvas/input/InputFeature'
import { SceneFeature } from './ui/canvas/scene/SceneFeature'
import { ViewportOverlays } from './ui/canvas/overlay/ViewportOverlays'
import { SelectionBoxOverlay } from './ui/canvas/overlay/SelectionBoxOverlay'
import { CanvasChrome } from './ui/canvas/chrome/CanvasChrome'
import { useContextMenuSession } from './ui/context-menu/useContextMenuSession'
import { useNodeInteractions } from './features/node/hooks/useNodeInteractions'
import { useNodeSizeObserver } from './features/node/hooks/useNodeSizeObserver'
import { useMindmapDrag } from './features/mindmap/hooks/drag/useMindmapDrag'
import {
  createWhiteboardInstance,
  type InternalWhiteboardInstance,
  type WhiteboardInstance,
  type WhiteboardRuntimeConfig
} from './runtime/instance'
import { createToolState } from './runtime/instance/toolState'

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
    handleNodeDoubleClick,
    handleNodePointerDown,
    handleTransformPointerDown
  } = useNodeInteractions()
  const {
    handleMindmapNodePointerDown
  } = useMindmapDrag()
  const contextMenu = useContextMenuSession()

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
        onOpenContextMenu={contextMenu.open}
      />
      <div className="wb-root-viewport" style={transformStyle}>
        <SceneFeature
          registerMeasuredElement={registerMeasuredElement}
          onNodePointerDown={handleNodePointerDown}
          onNodeDoubleClick={handleNodeDoubleClick}
          onMindmapNodePointerDown={handleMindmapNodePointerDown}
        />
        <ViewportOverlays
          onTransformPointerDown={handleTransformPointerDown}
        />
      </div>
      <SelectionBoxOverlay />
      <CanvasChrome
        containerRef={containerRef}
        contextMenuSession={contextMenu.session}
        closeContextMenu={contextMenu.close}
      />
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
  const initialToolRef = useRef(resolvedConfig.tool)
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
  const viewportState = useMemo(
    () => createValueStore(initialViewportRef.current),
    []
  )
  const toolState = useMemo(
    () => createToolState(initialToolRef.current),
    []
  )
  const lockOwner = useMemo(
    () => ({}),
    []
  )
  const viewport = useViewportController({
    viewportState,
    lockOwner,
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
      toolState,
      viewport,
      registry,
      lockOwner
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
