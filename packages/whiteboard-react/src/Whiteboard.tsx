import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createCore, type Core, type Document } from '@whiteboard/core'
import type { CSSProperties } from 'react'
import { DragGuidesLayer, NodeLayer, SelectionLayer } from './node/components'
import { EdgeLayerStack } from './edge/components'
import { createDefaultNodeRegistry, NodeRegistryProvider } from './node/registry'
import type { WhiteboardProps } from 'types/common'
import {
  createEngine,
  normalizeConfig,
  toLifecycleConfig,
  toInstanceConfig,
  type Instance
} from '@whiteboard/engine'
import { MindmapLayerStack } from './mindmap/components'
import { InstanceProvider } from './common/hooks/useInstance'

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

const WhiteboardInner = forwardRef<Instance | null, WhiteboardProps>(function WhiteboardInner(
  { doc, onDocChange, core: externalCore, nodeRegistry, config },
  ref
) {
  const resolvedConfig = useMemo(() => normalizeConfig(config), [config])

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
      createEngine({
        core,
        docRef,
        containerRef,
        config: instanceConfig
      }),
    [core, docRef, instanceConfig]
  )

  useImperativeHandle(ref, () => instance, [instance])

  useEffect(() => {
    void instance.apply([{ type: 'doc.reset', doc }], { source: 'import' })
  }, [doc, instance])

  const lifecycleConfig = useMemo(
    () =>
      toLifecycleConfig({
        instance,
        docId: doc.id,
        tool: resolvedConfig.tool,
        mindmapLayout: resolvedConfig.mindmapLayout,
        viewport: doc.viewport,
        viewportConfig: resolvedConfig.viewport,
        history: resolvedConfig.history,
        shortcuts: resolvedConfig.shortcuts
      }),
    [
      doc.id,
      resolvedConfig.history.enabled,
      resolvedConfig.history.capacity,
      resolvedConfig.history.captureSystem,
      resolvedConfig.history.captureRemote,
      instance,
      doc.viewport?.center?.x,
      doc.viewport?.center?.y,
      doc.viewport?.zoom,
      resolvedConfig.shortcuts,
      resolvedConfig.tool,
      resolvedConfig.mindmapLayout.mode,
      resolvedConfig.mindmapLayout.options?.hGap,
      resolvedConfig.mindmapLayout.options?.vGap,
      resolvedConfig.mindmapLayout.options?.side,
      resolvedConfig.viewport?.enablePan,
      resolvedConfig.viewport?.enableWheel,
      resolvedConfig.viewport?.maxZoom,
      resolvedConfig.viewport?.minZoom,
      resolvedConfig.viewport?.wheelSensitivity
    ]
  )

  const lifecycle = instance.lifecycle

  useEffect(() => {
    lifecycle.start()
    return () => {
      lifecycle.stop()
    }
  }, [lifecycle])

  useEffect(() => {
    lifecycle.update(lifecycleConfig)
  }, [lifecycle, lifecycleConfig])

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      ...(resolvedConfig.style as CSSProperties | undefined)
    }),
    [resolvedConfig.style]
  )

  const [viewportTransform, setViewportTransform] = useState(() => instance.view.global.viewportTransform())
  useEffect(() => {
    const update = () => {
      const next = instance.view.global.viewportTransform()
      setViewportTransform((prev) => (Object.is(prev, next) ? prev : next))
    }
    update()
    return instance.view.global.watchViewportTransform(update)
  }, [instance])

  const transformStyle = useMemo<CSSProperties>(
    () => ({
      transform: viewportTransform.transform,
      transformOrigin: '0 0',
      ...viewportTransform.cssVars
    }),
    [viewportTransform]
  )

  return (
    <InstanceProvider value={instance}>
      <NodeRegistryProvider registry={registry}>
        <div
          ref={containerRef}
          className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
          style={containerStyle}
          tabIndex={0}
        >
          <div className="wb-root-viewport" style={transformStyle}>
            <EdgeLayerStack />
            <MindmapLayerStack />
            <DragGuidesLayer />
            <NodeLayer />
          </div>
          <SelectionLayer />
        </div>
      </NodeRegistryProvider>
    </InstanceProvider>
  )
})

export const Whiteboard = WhiteboardInner
