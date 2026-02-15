import type { WhiteboardInstance } from '@engine-types/instance'
import type { WhiteboardLifecycleConfig, WhiteboardLifecycleRuntime as WhiteboardLifecycleRuntimeApi } from '@engine-types/instance'
import type { CanvasEventHandlers, CanvasInputRuntime } from './input/types'
import type { SelectionCallbacksBinding } from './bindings/bindSelectionCallbacks'
import { createCanvasInputHandlers } from './input/canvas/createCanvasInputHandlers'
import { createEdgeInputWindowBindings } from './input/edge/createEdgeInputWindowBindings'
import { createMindmapInputWindowBinding } from './input/mindmap/createMindmapInputWindowBinding'
import { createNodeInputWindowBindings } from './input/node/createNodeInputWindowBindings'
import { createSelectionInputBindings } from './input/selection/createSelectionInputBindings'
import { createDefaultLifecycleConfig } from './config/createDefaultLifecycleConfig'
import { HistoryBindingController } from './history/HistoryBindingController'
import { ContainerLifecycleController } from './container/ContainerLifecycleController'
import { WindowSpaceKeyController } from './keyboard/WindowSpaceKeyController'
import { GroupAutoFitLifecycleController } from './group/GroupAutoFitLifecycleController'
import { RuntimeCleanupController } from './cleanup/RuntimeCleanupController'
import { WindowBindingsOrchestrator } from './bindings/WindowBindingsOrchestrator'

export class WhiteboardLifecycleRuntime implements WhiteboardLifecycleRuntimeApi {
  private instance: WhiteboardInstance
  private started = false
  private config: WhiteboardLifecycleConfig
  private inputRuntime: CanvasInputRuntime
  private windowBindingsOrchestrator: WindowBindingsOrchestrator
  private selectionCallbacksBinding: SelectionCallbacksBinding
  private historyBindingController: HistoryBindingController
  private containerLifecycleController: ContainerLifecycleController
  private windowSpaceKeyController: WindowSpaceKeyController
  private groupAutoFitLifecycleController: GroupAutoFitLifecycleController
  private runtimeCleanupController: RuntimeCleanupController

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
    this.config = createDefaultLifecycleConfig(instance)
    this.inputRuntime = createCanvasInputHandlers({ instance: this.instance, config: this.config })
    this.historyBindingController = new HistoryBindingController(this.instance)
    this.containerLifecycleController = new ContainerLifecycleController({
      instance: this.instance,
      getHandlers: () => this.delegatedHandlers,
      getOnWheel: () => this.onWheel
    })
    this.windowSpaceKeyController = new WindowSpaceKeyController(this.instance)
    this.groupAutoFitLifecycleController = new GroupAutoFitLifecycleController(this.instance)
    this.runtimeCleanupController = new RuntimeCleanupController(this.instance)
    const edgeWindowBindings = createEdgeInputWindowBindings(this.instance)
    const nodeWindowBindings = createNodeInputWindowBindings(this.instance)

    const mindmapDragWindowBinding = createMindmapInputWindowBinding(this.instance)
    const selectionBindings = createSelectionInputBindings({
      instance: this.instance,
      getSelectionBox: () => this.inputRuntime.selectionBox
    })
    this.selectionCallbacksBinding = selectionBindings.selectionCallbacksBinding
    this.windowBindingsOrchestrator = new WindowBindingsOrchestrator({
      bindings: [
        edgeWindowBindings.edgeConnectWindowBinding,
        edgeWindowBindings.edgeRoutingPointDragWindowBinding,
        nodeWindowBindings.nodeDragWindowBinding,
        nodeWindowBindings.nodeTransformWindowBinding,
        mindmapDragWindowBinding,
        selectionBindings.selectionBoxWindowBinding
      ]
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

  private replaceInputRuntime = () => {
    this.inputRuntime.cancel()
    this.inputRuntime = createCanvasInputHandlers({ instance: this.instance, config: this.config })
  }

  start: WhiteboardLifecycleRuntimeApi['start'] = () => {
    if (this.started) return
    this.started = true

    this.historyBindingController.start()
    this.groupAutoFitLifecycleController.start()
    this.windowSpaceKeyController.start()
    this.selectionCallbacksBinding.start()
    this.windowBindingsOrchestrator.start()
    this.containerLifecycleController.sync()
  }

  update: WhiteboardLifecycleRuntimeApi['update'] = (config) => {
    this.config = config
    this.replaceInputRuntime()
    this.selectionCallbacksBinding.update({
      onSelectionChange: config.onSelectionChange,
      onEdgeSelectionChange: config.onEdgeSelectionChange
    })
    this.historyBindingController.update(config)

    this.instance.commands.tool.set(config.tool)
    this.instance.runtime.viewport.setViewport(config.viewport)
    this.instance.runtime.shortcuts.setShortcuts(config.shortcuts)
    this.instance.state.write('mindmapLayout', config.mindmapLayout ?? {})

    if (config.tool !== 'edge') {
      this.instance.runtime.services.edgeHover.cancel()
    }

    if (!this.started) return

    this.containerLifecycleController.sync()
    this.windowBindingsOrchestrator.sync()
  }

  stop: WhiteboardLifecycleRuntimeApi['stop'] = () => {
    if (!this.started) return
    this.started = false

    this.historyBindingController.stop()

    this.inputRuntime.cancel()

    this.windowBindingsOrchestrator.stop()
    this.selectionCallbacksBinding.stop()

    this.containerLifecycleController.stop()
    this.windowSpaceKeyController.stop()

    this.groupAutoFitLifecycleController.stop()
    this.runtimeCleanupController.stop()
  }
}
