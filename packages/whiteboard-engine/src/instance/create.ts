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
import { createEdgeCommands } from '../domains/edge/commands/edgeCommands'
import { Actor as GroupAutoFitActor } from '../runtime/actors/groupAutoFit/Actor'
import { Actor as InteractionActor } from '../runtime/actors/interaction/Actor'
import { Actor as MindmapActor } from '../domains/mindmap/commands/Actor'
import { createNodeCommands } from '../domains/node/commands/nodeCommands'
import { Actor as SelectionActor } from '../domains/selection/commands/Actor'
import { Actor as ShortcutActor } from '../runtime/actors/shortcut/Actor'
import { Domain as ViewportDomainActor } from '../runtime/actors/viewport/Domain'
import { NodeInputGateway } from '../domains/node/interaction/Gateway'
import { EdgeInputGateway } from '../domains/edge/interaction/Gateway'
import { MindmapInputGateway } from '../domains/mindmap/interaction/Gateway'
import { SelectionInputGateway } from '../domains/selection/interaction/Gateway'
import { ViewportRuntime } from '../runtime/viewport'
import { createQueryRuntime } from '../runtime/query/Store'
import { createViewRegistry } from '../runtime/view/Registry'
import { createDocumentStore } from '../document/Store'
import { NodeMeasureQueue } from '../runtime/host/NodeMeasureQueue'
import { RenderCoordinator } from '../runtime/render/RenderCoordinator'
import { clearInteractionKinds } from '../shared/interactionSession'
import {
  bindEdgeDomainApiById,
  bindMindmapDomainApiById,
  bindNodeDomainApiById,
  createEdgeDomainApi,
  createMindmapDomainApi,
  createNodeDomainApi,
  createSelectionDomainApi,
  createViewportDomainApi
} from '../domains'

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
  const render = new RenderCoordinator()
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
    render,
    projection,
    query: queryRuntime.query,
    config
  })

  const instance: InternalInstance = {
    mutate: null as unknown as InternalInstance['mutate'],
    state,
    render,
    projection,
    input: null as unknown as InternalInstance['input'],
    document: documentStore,
    config,
    viewport,
    registries: runtimeRegistries,
    query: queryRuntime.query,
    view: viewRuntime.view,
    domains: null as unknown as InternalInstance['domains'],
    node: null as unknown as InternalInstance['node'],
    edge: null as unknown as InternalInstance['edge'],
    mindmap: null as unknown as InternalInstance['mindmap'],
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
  const nodeMeasureQueue = new NodeMeasureQueue({
    scheduler,
    projection,
    mutate
  })
  projection.subscribe((commit) => {
    if (commit.kind === 'replace') {
      nodeMeasureQueue.clear()
    }
  })

  const edgeCommands = createEdgeCommands({ instance })
  const edgeInputGateway = new EdgeInputGateway({
    instance,
    scheduler,
    edgeCommands: {
      insertRoutingPointAt: edgeCommands.insertRoutingPointAt,
      removeRoutingPointAt: edgeCommands.removeRoutingPointAt
    }
  })
  const nodeCommands = createNodeCommands({ instance })
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
  const selectionInputGateway = new SelectionInputGateway({
    instance
  })
  const clearRoutingTransient = () => {
    const cancelled = edgeInputGateway.routingInput.cancelDraft()
    if (cancelled) return
    render.batch(() => {
      render.write('routingDrag', {})
      clearInteractionKinds(render, ['routingDrag'])
    })
  }
  const resetSelectionTransient = () => {
    clearRoutingTransient()
    render.write('groupHover', {})
    selectionInputGateway.resetTransientState()
  }
  const cancelAllInputInteractions = () => {
    nodeInputGateway.cancelInteractions()
    edgeInputGateway.cancelInteractions()
    mindmapInputGateway.cancelDrag()
    selectionInputGateway.cancelBox()
  }
  const resetAllInputTransientState = () => {
    nodeInputGateway.resetTransientState()
    edgeInputGateway.resetTransientState()
    mindmapInputGateway.resetTransientState()
    selectionInputGateway.resetTransientState()
  }
  const getActiveRoutingDrag = () => render.read('routingDrag').payload
  const selectionActor = new SelectionActor({
    instance,
    resetTransient: resetSelectionTransient
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
        render.keyboard.setSpacePressed(pressed)
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
        nodeMeasureQueue.enqueue(id, size)
      },
      containerResized: (rect) => {
        viewport.setContainerRect(rect)
      }
    },
    selection: {
      select: selectionActor.select,
      toggle: selectionActor.toggle,
      clear: selectionActor.clear,
      getSelectedNodeIds: selectionActor.getSelectedNodeIds
    },
    edge: {
      create: edgeCommands.create,
      update: edgeCommands.update,
      delete: (ids) => {
        const activeDrag = getActiveRoutingDrag()
        if (activeDrag && ids.includes(activeDrag.edgeId)) {
          clearRoutingTransient()
        }
        return edgeCommands.delete(ids)
      },
      insertRoutingPoint: edgeCommands.insertRoutingPoint,
      moveRoutingPoint: edgeCommands.moveRoutingPoint,
      removeRoutingPoint: (edge, index) => {
        const activeDrag = getActiveRoutingDrag()
        if (activeDrag?.edgeId === edge.id && activeDrag.index === index) {
          clearRoutingTransient()
        }
        edgeCommands.removeRoutingPoint(edge, index)
      },
      resetRouting: (edge) => {
        const activeDrag = getActiveRoutingDrag()
        if (activeDrag?.edgeId === edge.id) {
          clearRoutingTransient()
        }
        edgeCommands.resetRouting(edge)
      },
      select: (id) => {
        const activeDrag = getActiveRoutingDrag()
        if (activeDrag && activeDrag.edgeId !== id) {
          clearRoutingTransient()
        }
        render.write('groupHover', {})
        edgeCommands.select(id)
      }
    },
    order: {
      node: {
        set: nodeCommands.setOrder,
        bringToFront: nodeCommands.bringToFront,
        sendToBack: nodeCommands.sendToBack,
        bringForward: nodeCommands.bringForward,
        sendBackward: nodeCommands.sendBackward
      },
      edge: {
        set: edgeCommands.setOrder,
        bringToFront: edgeCommands.bringToFront,
        sendToBack: edgeCommands.sendToBack,
        bringForward: edgeCommands.bringForward,
        sendBackward: edgeCommands.sendBackward
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
      create: nodeCommands.create,
      update: nodeCommands.update,
      updateData: nodeCommands.updateData,
      updateManyPosition: nodeCommands.updateManyPosition,
      delete: nodeCommands.delete
    },
    group: {
      create: nodeCommands.createGroup,
      ungroup: nodeCommands.ungroup
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
  instance.domains = {
    node: createNodeDomainApi({
      commands,
      nodeInput: {
        drag: nodeInputGateway.node,
        transform: nodeInputGateway.nodeTransform
      },
      query: queryRuntime.query,
      view: viewRuntime.view
    }),
    edge: createEdgeDomainApi({
      commands,
      edgeInput: {
        connect: edgeInputGateway.connectInput,
        routing: edgeInputGateway.routingInput
      },
      query: queryRuntime.query,
      view: viewRuntime.view
    }),
    mindmap: createMindmapDomainApi({
      commands,
      mindmapInput: {
        drag: mindmapInputGateway.dragInput
      },
      view: viewRuntime.view
    }),
    selection: createSelectionDomainApi({
      commands,
      selectionInput: {
        box: selectionInputGateway.boxInput
      },
      state,
      view: viewRuntime.view
    }),
    viewport: createViewportDomainApi({
      commands,
      query: queryRuntime.query,
      view: viewRuntime.view
    })
  }
  instance.node = (id) =>
    bindNodeDomainApiById(instance.domains.node, id)
  instance.edge = (id) =>
    bindEdgeDomainApiById(instance.domains.edge, id)
  instance.mindmap = (id) =>
    bindMindmapDomainApiById(instance.domains.mindmap, id)

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
      render,
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
      selectionInput: {
        box: selectionInputGateway.boxInput
      },
      inputLifecycle: {
        cancelAll: cancelAllInputInteractions,
        resetTransientState: resetAllInputTransientState
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
      groupAutoFit: groupAutoFitActor,
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
      inputPort.resetAll('forced')
      lifecycleRuntime.stop()
      prevHistoryDocId = undefined
      nodeMeasureQueue.clear()
      scheduler.cancelAll()
    }
  }

  instance.lifecycle = lifecyclePort

  return {
    state: instance.state,
    render: instance.render,
    projection: instance.projection,
    input: instance.input,
    query: instance.query,
    view: instance.view,
    domains: instance.domains,
    node: instance.node,
    edge: instance.edge,
    mindmap: instance.mindmap,
    events: instance.events,
    lifecycle: instance.lifecycle,
    commands: instance.commands
  }
}
