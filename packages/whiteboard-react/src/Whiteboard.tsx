import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import type { CSSProperties } from 'react'
import { NodeFeature } from './node/components'
import { EdgeFeature } from './edge/components'
import { createDefaultNodeRegistry, NodeRegistryProvider } from './node/registry'
import type { NodeRegistry } from 'types/node'
import type { WhiteboardProps } from 'types/common'
import { engine, type Instance as EngineInstance } from '@whiteboard/engine'
import { normalizeConfig, toEngineInstanceConfig } from './config'
import { MindmapFeature } from './mindmap/components'
import { InstanceProvider } from './common/hooks/useInstance'
import { ShortcutFeature } from './common/interaction/ShortcutFeature'
import { SelectionFeature } from './selection/SelectionFeature'
import {
  DEFAULT_VIEWPORT,
  useViewportController,
  useViewportTransformStyle
} from './viewport'
import {
  createWhiteboardUiStore,
  createWhiteboardInstance,
  type InternalWhiteboardInstance,
  type WhiteboardInstance,
  type WhiteboardRuntimeConfig
} from './common/instance'
import { createTransient } from './transient'

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
  instance: InternalWhiteboardInstance
  registry: NodeRegistry
  resolvedConfig: ReturnType<typeof normalizeConfig>
  containerRef: {
    current: HTMLDivElement | null
  }
  containerStyle: CSSProperties
}

const WhiteboardCanvas = ({
  instance,
  registry,
  resolvedConfig,
  containerRef,
  containerStyle
}: WhiteboardCanvasProps) => {
  const transformStyle = useViewportTransformStyle()
  const transient = useMemo(
    () => createTransient(instance.uiStore),
    [instance.uiStore]
  )

  return (
    <NodeRegistryProvider registry={registry}>
      <div
        ref={containerRef}
        className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
        style={containerStyle}
        tabIndex={0}
      >
        <ShortcutFeature
          instance={instance}
          containerRef={containerRef}
          shortcuts={resolvedConfig.shortcuts}
        />
        <div className="wb-root-viewport" style={transformStyle}>
          <NodeFeature transient={transient} />
          <EdgeFeature
            containerRef={containerRef}
            node={transient.node}
            connection={transient.connection}
            edge={transient.edge}
          />
          <MindmapFeature mindmap={transient.mindmap} />
        </div>
        <SelectionFeature
          instance={instance}
          containerRef={containerRef}
          selection={transient.selection}
        />
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
      viewport
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
        instance={instance}
        registry={registry}
        resolvedConfig={resolvedConfig}
        containerRef={containerRef}
        containerStyle={containerStyle}
      />
    </InstanceProvider>
  )
})

export const Whiteboard = WhiteboardInner
