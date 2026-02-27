import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import type { Commands } from '@engine-types/commands'
import { createRegistries } from '@whiteboard/core/kernel'
import { createStore } from 'jotai/vanilla'
import type { DocumentId } from '@whiteboard/core/types'
import { createShortcuts } from '../runtime/shortcut'
import { createWriteRuntime } from '../runtime/write/runtime/createWriteRuntime'
import { resolveInstanceConfig } from '../config'
import { createState } from '../state/factory/CreateState'
import { Scheduler } from '../runtime/Scheduler'
import { GroupAutoFitRuntime } from '../runtime/write/postMutation/GroupAutoFitRuntime'
import { ViewportRuntime } from '../runtime/Viewport'
import { createQueryRuntime } from '../runtime/read/api/Runtime'
import { createReadRuntime } from '../runtime/read/Runtime'
import { createReadModelAtoms } from '../runtime/read/atoms/readModel'
import { createDocumentStore } from '../document/Store'
import { NodeMeasureQueue } from '../runtime/host/NodeMeasureQueue'
import {
  bindEdgeDomainApiById,
  bindMindmapDomainApiById,
  bindNodeDomainApiById,
  createDomainApis
} from '../domains/api'

export const createEngine = ({
  registries,
  document,
  onDocumentChange,
  config: overrides
}: CreateEngineOptions): Instance => {
  const runtimeStore = createStore()
  const scheduler = new Scheduler()
  const config = resolveInstanceConfig(overrides)
  const runtimeRegistries = registries ?? createRegistries()
  const documentStore = createDocumentStore(document, onDocumentChange)
  const { state, stateAtoms } = createState({
    getDoc: documentStore.get,
    store: runtimeStore
  })
  const readModelAtoms = createReadModelAtoms({
    documentAtom: stateAtoms.document,
    revisionAtom: stateAtoms.readModelRevision
  })
  const viewport = new ViewportRuntime({
    readViewport: () => runtimeStore.get(stateAtoms.viewport),
    writeViewport: (nextViewport) => {
      runtimeStore.set(stateAtoms.viewport, nextViewport)
    }
  })

  const queryRuntime = createQueryRuntime({
    readSnapshot: () => runtimeStore.get(readModelAtoms.snapshot),
    config,
    readDoc: documentStore.get,
    viewport
  })
  const readRuntime = createReadRuntime({
    state,
    runtimeStore,
    stateAtoms,
    readModelAtoms,
    query: queryRuntime.query,
    config
  })
  const read = readRuntime.read

  const instance: InternalInstance = {
    mutate: null as unknown as InternalInstance['mutate'],
    state,
    runtime: {
      store: runtimeStore
    },
    document: documentStore,
    config,
    viewport,
    registries: runtimeRegistries,
    query: queryRuntime.query,
    read,
    domains: null as unknown as InternalInstance['domains'],
    node: null as unknown as InternalInstance['node'],
    edge: null as unknown as InternalInstance['edge'],
    mindmap: null as unknown as InternalInstance['mindmap'],
    lifecycle: null as unknown as InternalInstance['lifecycle'],
    commands: null as unknown as InternalInstance['commands']
  }
  state.write('tool', 'select')
  const resetSelectionTransient = () => {}
  const writeRuntime = createWriteRuntime({
    instance,
    scheduler,
    documentAtom: stateAtoms.document,
    readModelRevisionAtom: stateAtoms.readModelRevision,
    resetSelectionTransient
  })

  const mutate = writeRuntime.mutate
  const history = writeRuntime.history
  const resetDoc = writeRuntime.resetDoc
  const mutationMetaBus = writeRuntime.mutationMetaBus
  instance.mutate = mutate
  const nodeMeasureQueue = new NodeMeasureQueue({
    instance,
    scheduler,
  })
  mutationMetaBus.subscribe((meta) => {
    queryRuntime.applyMutation(meta)
    readRuntime.applyMutation(meta)
    if (meta.kind === 'replace') {
      nodeMeasureQueue.clear()
    }
  })

  const edgeCommands = writeRuntime.commands.edge
  const interactionCommands = writeRuntime.commands.interaction
  const viewportCommands = writeRuntime.commands.viewport
  const nodeCommands = writeRuntime.commands.node
  const mindmapCommands = writeRuntime.commands.mindmap
  const selectionCommands = writeRuntime.commands.selection
  const shortcutDispatcher = writeRuntime.commands.shortcut

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
      update: interactionCommands.update,
      clearHover: interactionCommands.clearHover
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
      select: selectionCommands.select,
      toggle: selectionCommands.toggle,
      clear: selectionCommands.clear,
      getSelectedNodeIds: selectionCommands.getSelectedNodeIds
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
      set: viewportCommands.set,
      panBy: viewportCommands.panBy,
      zoomBy: viewportCommands.zoomBy,
      zoomTo: viewportCommands.zoomTo,
      reset: viewportCommands.reset
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
      create: mindmapCommands.create,
      replace: mindmapCommands.replace,
      delete: mindmapCommands.delete,
      addChild: mindmapCommands.addChild,
      addSibling: mindmapCommands.addSibling,
      moveSubtree: mindmapCommands.moveSubtree,
      removeSubtree: mindmapCommands.removeSubtree,
      cloneSubtree: mindmapCommands.cloneSubtree,
      toggleCollapse: mindmapCommands.toggleCollapse,
      setNodeData: mindmapCommands.setNodeData,
      reorderChild: mindmapCommands.reorderChild,
      setSide: mindmapCommands.setSide,
      attachExternal: mindmapCommands.attachExternal,
      insertNode: mindmapCommands.insertNode,
      moveSubtreeWithLayout: mindmapCommands.moveSubtreeWithLayout,
      moveSubtreeWithDrop: mindmapCommands.moveSubtreeWithDrop,
      moveRoot: mindmapCommands.moveRoot
    }
  }
  instance.commands = commands
  instance.domains = createDomainApis({ instance })
  instance.node = (id) =>
    bindNodeDomainApiById(instance.domains.node, id)
  instance.edge = (id) =>
    bindEdgeDomainApiById(instance.domains.edge, id)
  instance.mindmap = (id) =>
    bindMindmapDomainApiById(instance.domains.mindmap, id)

  const groupAutoFitRuntime = new GroupAutoFitRuntime({
    instance,
    mutationMetaBus,
    scheduler
  })

  const shortcuts = createShortcuts({
    instance,
    runAction: shortcutDispatcher.execute
  })
  let prevHistoryDocId: DocumentId | undefined
  const lifecyclePort = {
    update: (nextConfig: Parameters<InternalInstance['lifecycle']['update']>[0]) => {
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
      state.write('tool', nextConfig.tool)
      viewport.setViewport(nextConfig.viewport)
      shortcuts.setShortcuts(nextConfig.shortcuts)
      state.write('mindmapLayout', nextConfig.mindmapLayout ?? {})
    },
    dispose: () => {
      prevHistoryDocId = undefined
      groupAutoFitRuntime.dispose()
      shortcuts.dispose()
      nodeMeasureQueue.clear()
      scheduler.cancelAll()
    }
  }

  instance.lifecycle = lifecyclePort

  return {
    state: instance.state,
    runtime: instance.runtime,
    query: instance.query,
    read: instance.read,
    domains: instance.domains,
    node: instance.node,
    edge: instance.edge,
    mindmap: instance.mindmap,
    lifecycle: instance.lifecycle,
    commands: instance.commands
  }
}
