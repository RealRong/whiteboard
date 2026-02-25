import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { Document } from '@whiteboard/core/types'
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
import { DomInputAdapter } from './common/input/DomInputAdapter'
import { useSelectionBoxInteraction } from './common/interaction/useSelectionBoxInteraction'

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
  { doc, onDocChange, registries, nodeRegistry, config },
  ref
) {
  const resolvedConfig = useMemo(() => normalizeConfig(config), [config])

  const initialDocRef = useRef(doc)
  const onDocChangeRef = useRef(onDocChange)

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
      createEngine({
        registries,
        document: initialDocRef.current,
        onDocumentChange: (nextDoc) => {
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
    void instance.commands.doc.reset(doc)
  }, [doc, instance])

  const lifecycleConfig = useMemo(
    () =>
      toLifecycleConfig({
        docId: doc.id,
        tool: resolvedConfig.tool,
        mindmapLayout: resolvedConfig.mindmapLayout,
        viewport: doc.viewport,
        history: resolvedConfig.history,
        shortcuts: resolvedConfig.shortcuts
      }),
    [
      doc.id,
      resolvedConfig.history.enabled,
      resolvedConfig.history.capacity,
      resolvedConfig.history.captureSystem,
      resolvedConfig.history.captureRemote,
      doc.viewport?.center?.x,
      doc.viewport?.center?.y,
      doc.viewport?.zoom,
      resolvedConfig.shortcuts,
      resolvedConfig.tool,
      resolvedConfig.mindmapLayout.mode,
      resolvedConfig.mindmapLayout.options?.hGap,
      resolvedConfig.mindmapLayout.options?.vGap,
      resolvedConfig.mindmapLayout.options?.side
    ]
  )

  const lifecycle = instance.lifecycle
  const inputAdapter = useMemo(
    () =>
      new DomInputAdapter(instance, {
        viewportPolicy: {
          panEnabled: resolvedConfig.viewport.enablePan,
          wheelEnabled: resolvedConfig.viewport.enableWheel,
          minZoom: resolvedConfig.viewport.minZoom,
          maxZoom: resolvedConfig.viewport.maxZoom,
          wheelSensitivity: resolvedConfig.viewport.wheelSensitivity
        },
        getContainer: () => containerRef.current
      }),
    [
      instance,
      resolvedConfig.viewport.enablePan,
      resolvedConfig.viewport.enableWheel,
      resolvedConfig.viewport.minZoom,
      resolvedConfig.viewport.maxZoom,
      resolvedConfig.viewport.wheelSensitivity
    ]
  )

  useEffect(() => {
    lifecycle.start()
    return () => {
      lifecycle.stop()
    }
  }, [lifecycle])

  useEffect(() => {
    inputAdapter.start()
    return () => {
      inputAdapter.stop()
    }
  }, [inputAdapter])

  useEffect(() => {
    lifecycle.update(lifecycleConfig)
  }, [lifecycle, lifecycleConfig])

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

  const [viewportTransform, setViewportTransform] = useState(
    () => instance.view.getState().viewport.transform
  )
  useEffect(() => {
    const update = () => {
      const next = instance.view.getState().viewport.transform
      setViewportTransform((prev) => (Object.is(prev, next) ? prev : next))
    }
    update()
    return instance.view.subscribe(update)
  }, [instance])

  const transformStyle = useMemo<CSSProperties>(
    () => ({
      transform: viewportTransform.transform,
      transformOrigin: '0 0',
      ...viewportTransform.cssVars
    }),
    [viewportTransform]
  )
  const { selectionRect, handleViewportPointerDown } = useSelectionBoxInteraction(instance)

  return (
    <InstanceProvider value={instance}>
      <NodeRegistryProvider registry={registry}>
        <div
          ref={containerRef}
          className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
          style={containerStyle}
          tabIndex={0}
        >
          <div
            className="wb-root-viewport"
            style={transformStyle}
            onPointerDown={handleViewportPointerDown}
          >
            <EdgeLayerStack />
            <MindmapLayerStack />
            <DragGuidesLayer />
            <NodeLayer />
          </div>
          <SelectionLayer rect={selectionRect} />
        </div>
      </NodeRegistryProvider>
    </InstanceProvider>
  )
})

export const Whiteboard = WhiteboardInner
