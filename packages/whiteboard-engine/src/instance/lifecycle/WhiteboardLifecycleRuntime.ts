import type { Core, CoreHistoryState, DocumentId } from '@whiteboard/core'
import type { WhiteboardInstance, WhiteboardStateSnapshot } from '@engine-types/instance'
import type { WhiteboardLifecycleConfig, WhiteboardLifecycleRuntime as WhiteboardLifecycleRuntimeApi } from '@engine-types/instance'
import type { CanvasEventHandlers, CanvasInputRuntime } from './input/types'
import { DEFAULT_DOCUMENT_VIEWPORT, DEFAULT_WHITEBOARD_CONFIG } from '../../config'
import { bindCanvasContainerEvents } from './bindings/bindCanvasContainerEvents'
import { createEdgeConnectWindowBinding, type EdgeConnectWindowBinding } from './bindings/bindEdgeConnectWindow'
import { createSelectionCallbacksBinding, type SelectionCallbacksBinding } from './bindings/bindSelectionCallbacks'
import { bindWindowSpaceKey } from './bindings/bindWindowSpaceKey'
import { createCanvasInputHandlers } from './input/createCanvasInputHandlers'

const createDefaultConfig = (instance: WhiteboardInstance): WhiteboardLifecycleConfig => ({
  docId: undefined,
  tool: 'select',
  viewport: {
    center: {
      x: DEFAULT_DOCUMENT_VIEWPORT.center.x,
      y: DEFAULT_DOCUMENT_VIEWPORT.center.y
    },
    zoom: DEFAULT_DOCUMENT_VIEWPORT.zoom
  },
  viewportConfig: {
    minZoom: DEFAULT_WHITEBOARD_CONFIG.viewport.minZoom,
    maxZoom: DEFAULT_WHITEBOARD_CONFIG.viewport.maxZoom,
    enablePan: DEFAULT_WHITEBOARD_CONFIG.viewport.enablePan,
    enableWheel: DEFAULT_WHITEBOARD_CONFIG.viewport.enableWheel,
    wheelSensitivity: instance.runtime.config.viewport.wheelSensitivity
  },
  history: undefined,
  shortcuts: undefined,
  onSelectionChange: undefined,
  onEdgeSelectionChange: undefined
})

type HistoryIdentity = {
  core: Core
  docId: DocumentId
}

const toHistoryState = (snapshot: CoreHistoryState): WhiteboardStateSnapshot['history'] => ({
  canUndo: snapshot.canUndo,
  canRedo: snapshot.canRedo,
  undoDepth: snapshot.undoDepth,
  redoDepth: snapshot.redoDepth,
  isApplying: snapshot.isApplying,
  lastUpdatedAt: snapshot.lastUpdatedAt
})

export class WhiteboardLifecycleRuntime implements WhiteboardLifecycleRuntimeApi {
  private instance: WhiteboardInstance
  private started = false
  private config: WhiteboardLifecycleConfig
  private inputRuntime: CanvasInputRuntime
  private offContainerEvents: (() => void) | null = null
  private offWindowSpaceKey: (() => void) | null = null
  private edgeConnectWindowBinding: EdgeConnectWindowBinding
  private selectionCallbacksBinding: SelectionCallbacksBinding
  private offHistoryBinding: (() => void) | null = null
  private previousHistoryIdentity: HistoryIdentity | null = null
  private observedContainer: HTMLElement | null = null

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
    this.config = createDefaultConfig(instance)
    this.inputRuntime = createCanvasInputHandlers({ instance: this.instance, config: this.config })
    this.edgeConnectWindowBinding = createEdgeConnectWindowBinding({
      state: this.instance.state,
      events: this.instance.runtime.events,
      edgeConnectCommands: this.instance.commands.edgeConnect
    })
    this.selectionCallbacksBinding = createSelectionCallbacksBinding({
      state: this.instance.state
    })
  }

  private delegatedHandlers: CanvasEventHandlers = {
    handlePointerDown: (event) => {
      this.inputRuntime.handlers.handlePointerDown(event)
    },
    handlePointerDownCapture: (event) => {
      this.inputRuntime.handlers.handlePointerDownCapture(event)
    },
    handlePointerMove: (event) => {
      this.inputRuntime.handlers.handlePointerMove(event)
    },
    handlePointerUp: (event) => {
      this.inputRuntime.handlers.handlePointerUp(event)
    },
    handleKeyDown: (event) => {
      this.inputRuntime.handlers.handleKeyDown(event)
    }
  }

  private onWheel = (event: WheelEvent) => {
    this.inputRuntime.onWheel(event)
  }

  private syncContainerEventsBinding = () => {
    const container = this.instance.runtime.containerRef.current
    if (!container) return
    if (this.offContainerEvents) return
    this.offContainerEvents = bindCanvasContainerEvents({
      events: this.instance.runtime.events,
      handlers: this.delegatedHandlers,
      onWheel: this.onWheel
    })
  }

  private syncContainerObserverBinding = () => {
    const container = this.instance.runtime.containerRef.current
    if (!container) return
    if (this.observedContainer === container) return

    if (this.observedContainer) {
      this.instance.runtime.services.containerSizeObserver.unobserve(this.observedContainer)
      this.observedContainer = null
    }

    this.instance.runtime.services.containerSizeObserver.observe(container, this.instance.runtime.viewport.setContainerRect)
    this.observedContainer = container
  }

  private replaceInputRuntime = () => {
    this.inputRuntime.cancel()
    this.inputRuntime = createCanvasInputHandlers({ instance: this.instance, config: this.config })
  }

  private syncWindowSpaceKeyBinding = () => {
    if (this.offWindowSpaceKey) return
    this.offWindowSpaceKey = bindWindowSpaceKey({
      events: this.instance.runtime.events,
      setSpacePressed: this.instance.commands.keyboard.setSpacePressed
    })
  }

  private syncHistoryBinding = () => {
    if (this.offHistoryBinding) return
    const sync = (snapshot: CoreHistoryState) => {
      this.instance.state.write('history', toHistoryState(snapshot))
    }
    sync(this.instance.runtime.core.commands.history.getState())
    this.offHistoryBinding = this.instance.runtime.core.commands.history.subscribe(sync)
  }

  private updateHistoryLifecycle = (config: WhiteboardLifecycleConfig) => {
    if (config.history) {
      this.instance.commands.history.configure(config.history)
    }

    if (!config.docId) {
      this.previousHistoryIdentity = null
      return
    }

    const nextIdentity: HistoryIdentity = {
      core: this.instance.runtime.core,
      docId: config.docId
    }
    const previous = this.previousHistoryIdentity
    this.previousHistoryIdentity = nextIdentity

    if (!previous) return
    if (previous.core === nextIdentity.core && previous.docId === nextIdentity.docId) return
    this.instance.commands.history.clear()
  }

  private startGroupAutoFit = () => {
    this.instance.runtime.services.groupAutoFit.start({
      getDocId: () => this.instance.runtime.docRef.current?.id,
      getNodes: () => this.instance.runtime.docRef.current?.nodes ?? [],
      getNodeSize: () => this.instance.runtime.config.nodeSize,
      getPadding: () => this.instance.runtime.config.node.groupPadding
    })
  }

  start: WhiteboardLifecycleRuntimeApi['start'] = () => {
    if (this.started) return
    this.started = true

    this.syncHistoryBinding()
    this.startGroupAutoFit()
    this.syncWindowSpaceKeyBinding()
    this.selectionCallbacksBinding.start()
    this.edgeConnectWindowBinding.start()
    this.syncContainerEventsBinding()
    this.syncContainerObserverBinding()
  }

  update: WhiteboardLifecycleRuntimeApi['update'] = (config) => {
    this.config = config
    this.replaceInputRuntime()
    this.selectionCallbacksBinding.update({
      onSelectionChange: config.onSelectionChange,
      onEdgeSelectionChange: config.onEdgeSelectionChange
    })
    this.updateHistoryLifecycle(config)

    this.instance.commands.tool.set(config.tool)
    this.instance.runtime.viewport.setViewport(config.viewport)
    this.instance.runtime.shortcuts.setShortcuts(config.shortcuts)

    if (config.tool !== 'edge') {
      this.instance.runtime.services.edgeHover.cancel()
    }

    if (!this.started) return

    this.syncContainerEventsBinding()
    this.syncContainerObserverBinding()
    this.edgeConnectWindowBinding.sync()
  }

  stop: WhiteboardLifecycleRuntimeApi['stop'] = () => {
    if (!this.started) return
    this.started = false

    this.offHistoryBinding?.()
    this.offHistoryBinding = null
    this.previousHistoryIdentity = null

    this.inputRuntime.cancel()
    this.instance.commands.keyboard.setSpacePressed(false)
    this.instance.commands.transient.reset()

    this.edgeConnectWindowBinding.stop()
    this.selectionCallbacksBinding.stop()

    this.offContainerEvents?.()
    this.offContainerEvents = null

    this.offWindowSpaceKey?.()
    this.offWindowSpaceKey = null

    if (this.observedContainer) {
      this.instance.runtime.services.containerSizeObserver.unobserve(this.observedContainer)
      this.observedContainer = null
    }

    this.instance.runtime.shortcuts.dispose()
    this.instance.runtime.services.nodeSizeObserver.dispose()
    this.instance.runtime.services.containerSizeObserver.dispose()
    this.instance.runtime.services.groupAutoFit.stop()
    this.instance.runtime.services.viewportNavigation.dispose()
    this.instance.runtime.services.edgeHover.dispose()
    this.instance.runtime.services.nodeTransform.dispose()
    this.instance.runtime.services.mindmapDrag.dispose()
  }
}
