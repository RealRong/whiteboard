import { useEffect, useMemo, useRef } from 'react'
import { createCore, type Core, type Document, type Viewport } from '@whiteboard/core'
import type { CSSProperties } from 'react'
import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer'
import type { HistoryState } from 'types/state'
import { DragGuidesLayer, NodeLayer, SelectionLayer } from './node/components'
import { EdgeLayerStack } from './edge/components'
import { useWhiteboardContextHydration, useWhiteboardLifecycle } from './common/lifecycle'
import { createDefaultNodeRegistry, NodeRegistryProvider } from './node/registry'
import type { WhiteboardProps } from 'types/common'
import { DEFAULT_MINDMAP_NODE_SIZE, DEFAULT_NODE_SIZE } from './common/utils/geometry'
import { createWhiteboardInstance } from './common/instance'
import { setStoreAtom } from './common/instance/store/setStoreAtom'
import { historyAtom } from './common/state'
import { MindmapLayerStack } from './mindmap/components'
import { DEFAULT_GROUP_PADDING } from './node/constants'

enablePatches()

const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

type ChangeOrigin = 'user' | 'system' | 'remote'

type PatchEntry = {
  forward: Patch[]
  backward: Patch[]
  timestamp: number
  origin?: ChangeOrigin
  source: 'single' | 'transaction'
}

type PendingPatchEntry = {
  patches: Patch[]
  inversePatches: Patch[]
  timestamp: number
}

type PatchCollectorState = {
  isApplying: boolean
  pending: PendingPatchEntry[]
  undo: PatchEntry[]
  redo: PatchEntry[]
  txDepth: number
  txForward: Patch[]
  txBackward: Patch[]
  txOrigin?: ChangeOrigin
  txTimestamp?: number
}

const createPatchCollectorState = (): PatchCollectorState => ({
  isApplying: false,
  pending: [],
  undo: [],
  redo: [],
  txDepth: 0,
  txForward: [],
  txBackward: [],
  txOrigin: undefined,
  txTimestamp: undefined
})

const createHistoryStateSnapshot = (collector: PatchCollectorState): HistoryState => ({
  canUndo: collector.undo.length > 0,
  canRedo: collector.redo.length > 0,
  undoDepth: collector.undo.length,
  redoDepth: collector.redo.length,
  isApplying: collector.isApplying,
  lastUpdatedAt: Date.now()
})

const replaceDocumentDraft = (draft: Draft<Document>, next: Document) => {
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

const WhiteboardInner = ({ doc, onDocChange, core: externalCore, nodeRegistry, config }: WhiteboardProps) => {
  const resolvedConfig = {
    className: config?.className,
    style: config?.style,
    nodeSize: config?.nodeSize ?? DEFAULT_NODE_SIZE,
    mindmapNodeSize: config?.mindmapNodeSize ?? DEFAULT_MINDMAP_NODE_SIZE,
    mindmapLayout: config?.mindmapLayout ?? {},
    viewport: config?.viewport ?? {},
    node: config?.node ?? {},
    edge: config?.edge ?? {},
    history: config?.history ?? {},
    tool: config?.tool ?? 'select',
    shortcuts: config?.shortcuts,
    onSelectionChange: config?.onSelectionChange,
    onEdgeSelectionChange: config?.onEdgeSelectionChange,
    onHistoryChange: config?.onHistoryChange
  }

  const onHistoryChangeRef = useRef(resolvedConfig.onHistoryChange)
  onHistoryChangeRef.current = resolvedConfig.onHistoryChange

  const historyConfigRef = useRef({
    enabled: true,
    capacity: 100,
    captureSystem: true,
    captureRemote: false
  })
  historyConfigRef.current = {
    enabled: resolvedConfig.history.enabled ?? true,
    capacity: Math.max(0, resolvedConfig.history.capacity ?? 100),
    captureSystem: resolvedConfig.history.captureSystem ?? true,
    captureRemote: resolvedConfig.history.captureRemote ?? false
  }

  const docRef = useRef(doc)
  const onDocChangeRef = useRef(onDocChange)
  const coreRef = useRef<Core | null>(null)
  const patchCollectorRef = useRef<PatchCollectorState>(createPatchCollectorState())

  docRef.current = doc
  onDocChangeRef.current = onDocChange

  if (!coreRef.current) {
    coreRef.current =
      externalCore ??
      createCore({
        getState: () => docRef.current,
        apply: (recipe) => {
          const collector = patchCollectorRef.current
          const [nextDoc, patches, inversePatches] = produceWithPatches(docRef.current, recipe)
          docRef.current = nextDoc

          onDocChangeRef.current((draft) => {
            replaceDocumentDraft(draft, nextDoc)
          })

          if (!historyConfigRef.current.enabled) return
          if (collector.isApplying) return
          if (!patches.length) return

          collector.pending.push({
            patches,
            inversePatches,
            timestamp: Date.now()
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
  const instance = useMemo(
    () =>
      createWhiteboardInstance({
        core,
        docRef,
        containerRef,
        config: {
          nodeSize: resolvedConfig.nodeSize,
          mindmapNodeSize: resolvedConfig.mindmapNodeSize,
          node: {
            groupPadding: resolvedConfig.node.groupPadding ?? DEFAULT_GROUP_PADDING,
            snapThresholdScreen: resolvedConfig.node.snapThresholdScreen ?? 8,
            snapMaxThresholdWorld: resolvedConfig.node.snapMaxThresholdWorld ?? 24,
            snapGridCellSize: resolvedConfig.node.snapGridCellSize ?? 240,
            selectionMinDragDistance: resolvedConfig.node.selectionMinDragDistance ?? 3
          },
          edge: {
            hitTestThresholdScreen: resolvedConfig.edge.hitTestThresholdScreen ?? 10,
            anchorSnapMin: resolvedConfig.edge.anchorSnapMin ?? 12,
            anchorSnapRatio: resolvedConfig.edge.anchorSnapRatio ?? 0.18
          },
          viewport: {
            wheelSensitivity: resolvedConfig.viewport.wheelSensitivity ?? 0.001
          }
        }
      }),
    [
      core,
      docRef,
      resolvedConfig.edge.anchorSnapMin,
      resolvedConfig.edge.anchorSnapRatio,
      resolvedConfig.edge.hitTestThresholdScreen,
      resolvedConfig.mindmapNodeSize,
      resolvedConfig.node.groupPadding,
      resolvedConfig.node.selectionMinDragDistance,
      resolvedConfig.node.snapGridCellSize,
      resolvedConfig.node.snapMaxThresholdWorld,
      resolvedConfig.node.snapThresholdScreen,
      resolvedConfig.nodeSize,
      resolvedConfig.viewport.wheelSensitivity
    ]
  )

  useEffect(() => {
    const collector = patchCollectorRef.current

    const emitHistoryState = () => {
      const nextHistory = createHistoryStateSnapshot(collector)
      setStoreAtom(instance.state.store, historyAtom, nextHistory)
      onHistoryChangeRef.current?.(nextHistory)
    }

    const trimUndo = () => {
      const capacity = historyConfigRef.current.capacity
      if (capacity <= 0) {
        collector.undo = []
        return
      }
      if (collector.undo.length > capacity) {
        collector.undo.splice(0, collector.undo.length - capacity)
      }
    }

    const pushUndo = (entry: PatchEntry) => {
      if (!entry.forward.length || !entry.backward.length) return
      collector.undo.push(entry)
      collector.redo = []
      trimUndo()
      emitHistoryState()
    }

    const applyHistoryPatches = (patches: Patch[]) => {
      const nextDoc = applyPatches(docRef.current, patches)
      docRef.current = nextDoc
      onDocChangeRef.current((draft) => {
        replaceDocumentDraft(draft, nextDoc)
      })
    }

    const undo = () => {
      if (!collector.undo.length) {
        emitHistoryState()
        return
      }
      const entry = collector.undo.pop()
      if (!entry) return
      collector.isApplying = true
      emitHistoryState()
      try {
        applyHistoryPatches(entry.backward)
        collector.redo.push(entry)
      } finally {
        collector.isApplying = false
        emitHistoryState()
      }
    }

    const redo = () => {
      if (!collector.redo.length) {
        emitHistoryState()
        return
      }
      const entry = collector.redo.pop()
      if (!entry) return
      collector.isApplying = true
      emitHistoryState()
      try {
        applyHistoryPatches(entry.forward)
        collector.undo.push(entry)
        trimUndo()
      } finally {
        collector.isApplying = false
        emitHistoryState()
      }
    }

    const clear = () => {
      collector.pending = []
      collector.undo = []
      collector.redo = []
      collector.txDepth = 0
      collector.txForward = []
      collector.txBackward = []
      collector.txOrigin = undefined
      collector.txTimestamp = undefined
      collector.isApplying = false
      emitHistoryState()
    }

    const offAfter = core.changes.onAfter(({ changes }) => {
      if (!historyConfigRef.current.enabled) {
        collector.pending.shift()
        return
      }
      if (collector.isApplying) {
        collector.pending.shift()
        return
      }

      const pending = collector.pending.shift()
      if (!pending || !pending.patches.length) return

      if (changes.origin === 'system' && !historyConfigRef.current.captureSystem) {
        return
      }
      if (changes.origin === 'remote' && !historyConfigRef.current.captureRemote) {
        return
      }

      if (collector.txDepth > 0) {
        collector.txForward.push(...pending.patches)
        collector.txBackward = [...pending.inversePatches, ...collector.txBackward]
        collector.txOrigin ??= changes.origin
        collector.txTimestamp ??= pending.timestamp
        return
      }

      pushUndo({
        forward: pending.patches,
        backward: pending.inversePatches,
        timestamp: pending.timestamp,
        origin: changes.origin,
        source: 'single'
      })
    })

    const offTransactionStart = core.changes.transactionStart(() => {
      collector.txDepth += 1
      if (collector.txDepth > 1) return
      collector.txForward = []
      collector.txBackward = []
      collector.txOrigin = undefined
      collector.txTimestamp = undefined
    })

    const offTransactionEnd = core.changes.transactionEnd(() => {
      if (collector.txDepth <= 0) return
      collector.txDepth -= 1
      if (collector.txDepth > 0) return

      if (!collector.txForward.length || !collector.txBackward.length) {
        collector.txForward = []
        collector.txBackward = []
        collector.txOrigin = undefined
        collector.txTimestamp = undefined
        return
      }

      pushUndo({
        forward: collector.txForward,
        backward: collector.txBackward,
        timestamp: collector.txTimestamp ?? Date.now(),
        origin: collector.txOrigin,
        source: 'transaction'
      })

      collector.txForward = []
      collector.txBackward = []
      collector.txOrigin = undefined
      collector.txTimestamp = undefined
    })

    const unregisterHistoryUndo = core.registries.commands.register('history.undo', undo)
    const unregisterUndoAlias = core.registries.commands.register('undo', undo)
    const unregisterHistoryRedo = core.registries.commands.register('history.redo', redo)
    const unregisterRedoAlias = core.registries.commands.register('redo', redo)
    const unregisterHistoryClear = core.registries.commands.register('history.clear', clear)

    emitHistoryState()

    return () => {
      offAfter()
      offTransactionStart()
      offTransactionEnd()
      unregisterHistoryUndo()
      unregisterUndoAlias()
      unregisterHistoryRedo()
      unregisterRedoAlias()
      unregisterHistoryClear()
    }
  }, [core, instance])

  useEffect(() => {
    const collector = patchCollectorRef.current
    collector.pending = []
    collector.undo = []
    collector.redo = []
    collector.txDepth = 0
    collector.txForward = []
    collector.txBackward = []
    collector.txOrigin = undefined
    collector.txTimestamp = undefined
    collector.isApplying = false
    const nextHistory = createHistoryStateSnapshot(collector)
    setStoreAtom(instance.state.store, historyAtom, nextHistory)
    onHistoryChangeRef.current?.(nextHistory)
  }, [doc.id, instance])

  useWhiteboardContextHydration(doc, instance)

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      ...resolvedConfig.style
    }),
    [resolvedConfig.style]
  )

  const viewport = doc.viewport ?? DEFAULT_VIEWPORT
  const transformStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate(50%, 50%) scale(${viewport.zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
      transformOrigin: '0 0',
      ['--wb-zoom' as const]: `${viewport.zoom}`
    }),
    [viewport.center.x, viewport.center.y, viewport.zoom]
  )

  useWhiteboardLifecycle({
    viewport: doc.viewport,
    shortcutsProp: resolvedConfig.shortcuts,
    tool: resolvedConfig.tool,
    viewportConfig: resolvedConfig.viewport,
    onSelectionChange: resolvedConfig.onSelectionChange,
    onEdgeSelectionChange: resolvedConfig.onEdgeSelectionChange
  })

  return (
    <NodeRegistryProvider registry={registry}>
      <div
        ref={containerRef}
        className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
        style={containerStyle}
        tabIndex={0}
      >
        <div className="wb-root-viewport" style={transformStyle}>
          <EdgeLayerStack />
          <MindmapLayerStack layout={resolvedConfig.mindmapLayout} />
          <DragGuidesLayer />
          <NodeLayer />
        </div>
        <SelectionLayer />
      </div>
    </NodeRegistryProvider>
  )
}

export const Whiteboard = (props: WhiteboardProps) => {
  return <WhiteboardInner {...props} />
}
