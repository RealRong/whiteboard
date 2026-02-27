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
import { createShortcuts } from '../runtime/shortcut'
import { Lifecycle } from '../runtime/lifecycle/Lifecycle'
import { HistoryDomain } from '../runtime/history/HistoryDomain'
import { DocChangePublisher } from '../runtime/write/DocChangePublisher'
import { MutationExecutor } from '../runtime/write/MutationExecutor'
import { WriteCoordinator } from '../runtime/write/WriteCoordinator'
import { DEFAULT_DOCUMENT_VIEWPORT, resolveInstanceConfig } from '../config'
import { createState } from '../state/factory'
import { Scheduler } from '../runtime/Scheduler'
import { createEdgeCommands } from '../domains/edge/commands'
import { Actor as GroupAutoFitActor } from '../runtime/actors/groupAutoFit/Actor'
import { Actor as InteractionActor } from '../runtime/actors/interaction/Actor'
import { createMindmapController } from '../domains/mindmap/commands'
import { createNodeCommands } from '../domains/node/commands'
import { createSelectionController } from '../domains/selection/commands'
import { Actor as ShortcutActor } from '../runtime/actors/shortcut/Actor'
import { Domain as ViewportDomainActor } from '../runtime/actors/viewport/Domain'
import { ViewportRuntime } from '../runtime/viewport'
import { createQueryRuntime } from '../runtime/query/Store'
import { createReadRuntime } from '../runtime/read'
import { createDocumentStore } from '../document/Store'
import { NodeMeasureQueue } from '../runtime/host/NodeMeasureQueue'
import {
  bindEdgeDomainApiById,
  bindMindmapDomainApiById,
  bindNodeDomainApiById,
  createEdgeDomainApi,
  createMindmapDomainApi,
  createNodeDomainApi,
  createSelectionDomainApi,
  createViewportDomainApi
} from '../domains/api'

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
  const { state, projection, syncDocument, stateStore, stateAtoms } = createState({
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
  const readRuntime = createReadRuntime({
    state,
    stateStore,
    stateAtoms,
    projection,
    query: queryRuntime.query,
    config
  })

  const instance: InternalInstance = {
    mutate: null as unknown as InternalInstance['mutate'],
    state,
    projection,
    document: documentStore,
    config,
    viewport,
    registries: runtimeRegistries,
    query: queryRuntime.query,
    read: readRuntime,
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
  const nodeCommands = createNodeCommands({ instance })
  const mindmapActor = createMindmapController({
    instance
  })
  const interactionActor = new InteractionActor({
    state
  })
  const resetSelectionTransient = () => {}
  const selectionActor = createSelectionController({
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
      delete: edgeCommands.delete,
      insertRoutingPoint: edgeCommands.insertRoutingPoint,
      moveRoutingPoint: edgeCommands.moveRoutingPoint,
      removeRoutingPoint: edgeCommands.removeRoutingPoint,
      resetRouting: edgeCommands.resetRouting,
      select: (id) => {
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
      query: queryRuntime.query,
      read: readRuntime
    }),
    edge: createEdgeDomainApi({
      commands,
      query: queryRuntime.query,
      read: readRuntime
    }),
    mindmap: createMindmapDomainApi({
      commands,
      read: readRuntime
    }),
    selection: createSelectionDomainApi({
      commands,
      state,
      read: readRuntime
    }),
    viewport: createViewportDomainApi({
      commands,
      query: queryRuntime.query,
      read: readRuntime
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
  const lifecycleRuntime = new Lifecycle(
    {
      state,
      viewport,
      syncViewport: syncDocument,
      shortcuts,
      emit: events.emit
    },
    {
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
      lifecycleRuntime.stop()
      prevHistoryDocId = undefined
      nodeMeasureQueue.clear()
      scheduler.cancelAll()
    }
  }

  instance.lifecycle = lifecyclePort

  return {
    state: instance.state,
    projection: instance.projection,
    query: instance.query,
    read: instance.read,
    domains: instance.domains,
    node: instance.node,
    edge: instance.edge,
    mindmap: instance.mindmap,
    events: instance.events,
    lifecycle: instance.lifecycle,
    commands: instance.commands
  }
}
