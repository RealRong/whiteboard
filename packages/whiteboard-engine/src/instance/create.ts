import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import type { Commands } from '@engine-types/commands'
import { createRegistries } from '@whiteboard/core/kernel'
import type { InstanceEventMap } from '@engine-types/instance/events'
import type { DocumentId } from '@whiteboard/core/types'
import { EventCenter } from '../runtime/EventCenter'
import { createInputPort, createShortcuts } from '../input'
import { Lifecycle } from '../runtime/lifecycle/Lifecycle'
import { HistoryDomain } from '../runtime/history/HistoryDomain'
import { DocChangePublisher } from '../runtime/write/DocChangePublisher'
import { MutationExecutor } from '../runtime/write/MutationExecutor'
import { WriteCoordinator } from '../runtime/write/WriteCoordinator'
import { DEFAULT_DOCUMENT_VIEWPORT, resolveInstanceConfig } from '../config'
import { createState } from '../state/factory'
import { createDefaultPointerSessions } from '../input/sessions/defaults'
import { Scheduler } from '../runtime/Scheduler'
import { Actor as EdgeActor } from '../runtime/actors/edge/Actor'
import { Actor as GroupAutoFitActor } from '../runtime/actors/groupAutoFit/Actor'
import { Actor as InteractionActor } from '../runtime/actors/interaction/Actor'
import { Actor as MindmapActor } from '../runtime/actors/mindmap/Actor'
import { Actor as NodeActor } from '../runtime/actors/node/Actor'
import { Actor as SelectionActor } from '../runtime/actors/selection/Actor'
import { Actor as ShortcutActor } from '../runtime/actors/shortcut/Actor'
import { Domain as ViewportDomainActor } from '../runtime/actors/viewport/Domain'
import { NodeInputGateway } from '../runtime/nodeInput/Gateway'
import { EdgeInputGateway } from '../runtime/edgeInput/Gateway'
import { MindmapInputGateway } from '../runtime/mindmapInput/Gateway'
import { ViewportRuntime } from '../runtime/viewport'
import { createQueryRuntime } from '../runtime/query/Store'
import { createViewRegistry } from '../runtime/view/Registry'
import { createDocumentStore } from '../document/Store'

export const createEngine = ({
  registries,
  document,
  onDocumentChange,
  config: overrides
}: CreateEngineOptions): Instance => {
  const scheduler = new Scheduler()
  const config = resolveInstanceConfig(overrides)
  const runtimeRegistries = registries ?? createRegistries()
  const documentStore = createDocumentStore(document, onDocumentChange)
  const viewport = new ViewportRuntime()
  viewport.setViewport(documentStore.get()?.viewport ?? DEFAULT_DOCUMENT_VIEWPORT)
  const { state, projection, syncDocument } = createState({
    getDoc: documentStore.get,
    readViewport: viewport.get
  })
  const events = new EventCenter<InstanceEventMap>()
  const docChangePublisher = new DocChangePublisher({
    emit: events.emit
  })

  const queryRuntime = createQueryRuntime({
    projection,
    config,
    readDoc: documentStore.get,
    viewport
  })
  const viewRuntime = createViewRegistry({
    state,
    projection,
    query: queryRuntime.query,
    config
  })

  const instance: InternalInstance = {
    mutate: null as unknown as InternalInstance['mutate'],
    state,
    projection,
    input: null as unknown as InternalInstance['input'],
    document: documentStore,
    config,
    viewport,
    registries: runtimeRegistries,
    query: queryRuntime.query,
    view: viewRuntime.view,
    events: {
      on: events.on,
      off: events.off
    },
    emit: events.emit,
    lifecycle: null as unknown as InternalInstance['lifecycle'],
    commands: null as unknown as InternalInstance['commands']
  }
  state.write('tool', 'select')

  const mutationExecutor = new MutationExecutor({
    instance,
    projection,
    syncState: () => {
      viewport.setViewport(documentStore.get()?.viewport ?? DEFAULT_DOCUMENT_VIEWPORT)
      syncDocument()
    },
    now: scheduler.now
  })
  const historyDomain = new HistoryDomain({
    now: scheduler.now
  })
  const writeCoordinator = new WriteCoordinator({
    executor: mutationExecutor,
    history: historyDomain,
    publishApplied: docChangePublisher.publish
  })

  const mutate = writeCoordinator.applyMutations
  const history = writeCoordinator.history
  const resetDoc = writeCoordinator.resetDocument
  instance.mutate = mutate

  const edgeActor = new EdgeActor({
    instance
  })
  const edgeInputGateway = new EdgeInputGateway({
    instance,
    scheduler
  })
  const nodeActor = new NodeActor({
    instance
  })
  const nodeInputGateway = new NodeInputGateway({
    instance
  })
  const mindmapActor = new MindmapActor({
    instance
  })
  const mindmapInputGateway = new MindmapInputGateway({
    instance,
    mindmap: {
      moveRoot: mindmapActor.moveRoot,
      moveSubtreeWithDrop: mindmapActor.moveSubtreeWithDrop
    }
  })
  const interactionActor = new InteractionActor({
    state
  })
  const selectionActor = new SelectionActor({
    instance
  })
  const viewportActor = new ViewportDomainActor({
    instance
  })

  const { write } = state
  const commands: Commands = {
    doc: {
      reset: resetDoc
    },
    tool: {
      set: (tool) => {
        write('tool', tool)
      }
    },
    keyboard: {
      setSpacePressed: (pressed) => {
        write('spacePressed', pressed)
      }
    },
    history: {
      get: history.get,
      configure: history.configure,
      undo: history.undo,
      redo: history.redo,
      clear: history.clear
    },
    interaction: {
      update: interactionActor.update,
      clearHover: interactionActor.clearHover
    },
    host: {
      nodeMeasured: (id, size) => {
        if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return
        if (size.width <= 0 || size.height <= 0) return
        void mutate(
          [{
            type: 'node.update',
            id,
            patch: {
              size
            }
          }],
          'system'
        )
      },
      containerResized: (rect) => {
        viewport.setContainerRect(rect)
      }
    },
    selection: {
      select: selectionActor.select,
      toggle: selectionActor.toggle,
      clear: selectionActor.clear,
      getSelectedNodeIds: selectionActor.getSelectedNodeIds,
      beginBox: selectionActor.beginBox,
      updateBox: selectionActor.updateBox,
      endBox: selectionActor.endBox
    },
    edge: {
      create: edgeActor.create,
      update: edgeActor.update,
      delete: edgeActor.delete,
      insertRoutingPoint: edgeActor.insertRoutingPoint,
      moveRoutingPoint: edgeActor.moveRoutingPoint,
      removeRoutingPoint: edgeActor.removeRoutingPoint,
      resetRouting: edgeActor.resetRouting,
      select: edgeActor.select
    },
    order: {
      node: {
        set: nodeActor.setOrder,
        bringToFront: nodeActor.bringToFront,
        sendToBack: nodeActor.sendToBack,
        bringForward: nodeActor.bringForward,
        sendBackward: nodeActor.sendBackward
      },
      edge: {
        set: edgeActor.setOrder,
        bringToFront: edgeActor.bringToFront,
        sendToBack: edgeActor.sendToBack,
        bringForward: edgeActor.bringForward,
        sendBackward: edgeActor.sendBackward
      }
    },
    viewport: {
      set: viewportActor.set,
      panBy: viewportActor.panBy,
      zoomBy: viewportActor.zoomBy,
      zoomTo: viewportActor.zoomTo,
      reset: viewportActor.reset
    },
    node: {
      create: nodeActor.create,
      update: nodeActor.update,
      updateData: nodeActor.updateData,
      updateManyPosition: nodeActor.updateManyPosition,
      delete: nodeActor.delete
    },
    group: {
      create: nodeActor.createGroup,
      ungroup: nodeActor.ungroup
    },
    mindmap: {
      create: mindmapActor.create,
      replace: mindmapActor.replace,
      delete: mindmapActor.delete,
      addChild: mindmapActor.addChild,
      addSibling: mindmapActor.addSibling,
      moveSubtree: mindmapActor.moveSubtree,
      removeSubtree: mindmapActor.removeSubtree,
      cloneSubtree: mindmapActor.cloneSubtree,
      toggleCollapse: mindmapActor.toggleCollapse,
      setNodeData: mindmapActor.setNodeData,
      reorderChild: mindmapActor.reorderChild,
      setSide: mindmapActor.setSide,
      attachExternal: mindmapActor.attachExternal,
      insertNode: mindmapActor.insertNode,
      moveSubtreeWithLayout: mindmapActor.moveSubtreeWithLayout,
      moveSubtreeWithDrop: mindmapActor.moveSubtreeWithDrop,
      moveRoot: mindmapActor.moveRoot
    }
  }
  instance.commands = commands

  const groupAutoFitActor = new GroupAutoFitActor({
    instance,
    scheduler
  })

  const shortcutActor = new ShortcutActor({
    selection: selectionActor,
    history
  })
  const shortcuts = createShortcuts({
    instance,
    runAction: shortcutActor.execute
  })

  const inputPort = createInputPort({
    getContext: () => ({
      state,
      commands,
      query: queryRuntime.query,
      nodeInput: {
        drag: nodeInputGateway.node,
        transform: nodeInputGateway.nodeTransform
      },
      edgeInput: {
        connect: edgeInputGateway.connectInput,
        routing: edgeInputGateway.routingInput
      },
      mindmapInput: {
        drag: mindmapInputGateway.dragInput
      },
      viewport: {
        getZoom: queryRuntime.query.viewport.getZoom,
        clientToWorld: queryRuntime.query.viewport.clientToWorld
      },
      shortcuts,
      config
    }),
    sessions: createDefaultPointerSessions()
  })
  instance.input = inputPort
  const lifecycleRuntime = new Lifecycle(
    {
      state,
      viewport,
      syncViewport: syncDocument,
      shortcuts,
      emit: events.emit
    },
    {
      edgeInput: edgeInputGateway,
      mindmapInput: mindmapInputGateway,
      groupAutoFit: groupAutoFitActor,
      node: nodeActor,
      mindmap: mindmapActor,
      selection: selectionActor
    }
  )
  let prevHistoryDocId: DocumentId | undefined
  const lifecyclePort = {
    start: () => {
      lifecycleRuntime.start()
    },
    update: (nextConfig: Parameters<typeof lifecycleRuntime.update>[0]) => {
      if (nextConfig.history) {
        history.configure(nextConfig.history)
      }
      if (!nextConfig.docId) {
        prevHistoryDocId = undefined
      } else {
        if (prevHistoryDocId && prevHistoryDocId !== nextConfig.docId) {
          history.clear()
        }
        prevHistoryDocId = nextConfig.docId
      }
      lifecycleRuntime.update(nextConfig)
    },
    stop: () => {
      nodeInputGateway.node.cancel()
      nodeInputGateway.nodeTransform.cancel()
      lifecycleRuntime.stop()
      prevHistoryDocId = undefined
      scheduler.cancelAll()
    }
  }

  instance.lifecycle = lifecyclePort

  return {
    state: instance.state,
    projection: instance.projection,
    input: instance.input,
    query: instance.query,
    view: instance.view,
    events: instance.events,
    lifecycle: instance.lifecycle,
    commands: instance.commands
  }
}
