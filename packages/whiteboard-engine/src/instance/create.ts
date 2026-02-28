import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/instance'
import type { Shortcuts } from '@engine-types/shortcuts'
import type { Commands } from '@engine-types/commands'
import { createRegistries } from '@whiteboard/core/kernel'
import { createStore } from 'jotai/vanilla'
import type { DocumentId } from '@whiteboard/core/types'
import { createShortcuts } from '../runtime/shortcut'
import {
  createWriteRuntime,
  type WriteRuntime
} from '../runtime/write/createRuntime'
import { resolveInstanceConfig } from '../config'
import { createState } from '../state/factory/CreateState'
import { Scheduler } from '../runtime/Scheduler'
import { GroupAutoFitRuntime } from '../runtime/write/GroupAutoFitRuntime'
import { ViewportRuntime } from '../runtime/Viewport'
import { runtime as readRuntimeFactory } from '../runtime/read/runtime'
import { read as readAtomsFactory } from '../runtime/read/atoms/read'
import { createDocumentStore } from '../document/Store'
import { NodeMeasureQueue } from '../runtime/host/NodeMeasureQueue'

type CreateCommandsOptions = {
  state: InternalInstance['state']
  viewport: ViewportRuntime
  nodeMeasureQueue: NodeMeasureQueue
  writeRuntime: WriteRuntime
}

const createCommands = ({
  state,
  viewport,
  nodeMeasureQueue,
  writeRuntime
}: CreateCommandsOptions): Commands => {
  const { history, resetDoc } = writeRuntime
  const {
    edge,
    interaction,
    viewport: viewportCommands,
    node,
    mindmap,
    selection
  } = writeRuntime.commands

  return {
    doc: {
      reset: resetDoc
    },
    tool: {
      set: (tool) => {
        state.write('tool', tool)
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
      update: interaction.update,
      clearHover: interaction.clearHover
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
      select: selection.select,
      toggle: selection.toggle,
      clear: selection.clear,
      getSelectedNodeIds: selection.getSelectedNodeIds
    },
    edge: {
      create: edge.create,
      update: edge.update,
      delete: edge.delete,
      insertRoutingPoint: edge.insertRoutingPoint,
      moveRoutingPoint: edge.moveRoutingPoint,
      removeRoutingPoint: edge.removeRoutingPoint,
      resetRouting: edge.resetRouting,
      select: edge.select
    },
    order: {
      node: {
        set: node.setOrder,
        bringToFront: node.bringToFront,
        sendToBack: node.sendToBack,
        bringForward: node.bringForward,
        sendBackward: node.sendBackward
      },
      edge: {
        set: edge.setOrder,
        bringToFront: edge.bringToFront,
        sendToBack: edge.sendToBack,
        bringForward: edge.bringForward,
        sendBackward: edge.sendBackward
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
      create: node.create,
      update: node.update,
      updateData: node.updateData,
      updateManyPosition: node.updateManyPosition,
      delete: node.delete
    },
    group: {
      create: node.createGroup,
      ungroup: node.ungroup
    },
    mindmap: {
      create: mindmap.create,
      replace: mindmap.replace,
      delete: mindmap.delete,
      addChild: mindmap.addChild,
      addSibling: mindmap.addSibling,
      moveSubtree: mindmap.moveSubtree,
      removeSubtree: mindmap.removeSubtree,
      cloneSubtree: mindmap.cloneSubtree,
      toggleCollapse: mindmap.toggleCollapse,
      setNodeData: mindmap.setNodeData,
      reorderChild: mindmap.reorderChild,
      setSide: mindmap.setSide,
      attachExternal: mindmap.attachExternal,
      insertNode: mindmap.insertNode,
      moveSubtreeWithLayout: mindmap.moveSubtreeWithLayout,
      moveSubtreeWithDrop: mindmap.moveSubtreeWithDrop,
      moveRoot: mindmap.moveRoot
    }
  }
}

type CreateRuntimePortOptions = {
  state: InternalInstance['state']
  viewport: ViewportRuntime
  history: Commands['history']
  shortcuts: Shortcuts
  groupAutoFitRuntime: GroupAutoFitRuntime
  nodeMeasureQueue: NodeMeasureQueue
  scheduler: Scheduler
}

const createRuntimePort = ({
  state,
  viewport,
  history,
  shortcuts,
  groupAutoFitRuntime,
  nodeMeasureQueue,
  scheduler
}: CreateRuntimePortOptions): Pick<InternalInstance['runtime'], 'applyConfig' | 'dispose'> => {
  let prevHistoryDocId: DocumentId | undefined

  const applyConfig: InternalInstance['runtime']['applyConfig'] = (nextConfig) => {
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
  }

  const dispose: InternalInstance['runtime']['dispose'] = () => {
    prevHistoryDocId = undefined
    groupAutoFitRuntime.dispose()
    shortcuts.dispose()
    nodeMeasureQueue.clear()
    scheduler.cancelAll()
  }

  return {
    applyConfig,
    dispose
  }
}

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
  const readAtoms = readAtomsFactory({
    documentAtom: stateAtoms.document,
    revisionAtom: stateAtoms.readModelRevision
  })
  const viewport = new ViewportRuntime({
    readViewport: () => runtimeStore.get(stateAtoms.viewport),
    writeViewport: (nextViewport) => {
      runtimeStore.set(stateAtoms.viewport, nextViewport)
    }
  })

  const readRuntime = readRuntimeFactory({
    state,
    runtimeStore,
    stateAtoms,
    readAtoms,
    config,
    readDoc: documentStore.get,
    viewport
  })

  const instance: InternalInstance = {
    mutate: null as unknown as InternalInstance['mutate'],
    state,
    runtime: {
      store: runtimeStore,
      applyConfig: (() => {}) as InternalInstance['runtime']['applyConfig'],
      dispose: (() => {}) as InternalInstance['runtime']['dispose']
    },
    document: documentStore,
    config,
    viewport,
    registries: runtimeRegistries,
    query: readRuntime.query,
    read: readRuntime.read,
    commands: null as unknown as InternalInstance['commands']
  }
  state.write('tool', 'select')
  const writeRuntime = createWriteRuntime({
    instance,
    scheduler,
    documentAtom: stateAtoms.document,
    readModelRevisionAtom: stateAtoms.readModelRevision
  })

  instance.mutate = writeRuntime.mutate
  const nodeMeasureQueue = new NodeMeasureQueue({
    instance,
    scheduler
  })
  writeRuntime.changeBus.subscribe((change) => {
    readRuntime.applyChange(change)
    if (change.kind === 'replace') {
      nodeMeasureQueue.clear()
    }
  })

  instance.commands = createCommands({
    state,
    viewport,
    nodeMeasureQueue,
    writeRuntime
  })

  const groupAutoFitRuntime = new GroupAutoFitRuntime({
    instance,
    changeBus: writeRuntime.changeBus,
    scheduler
  })

  const shortcuts = createShortcuts({
    instance,
    runAction: writeRuntime.commands.shortcut.execute
  })
  const runtimePort = createRuntimePort({
    state,
    viewport,
    history: writeRuntime.history,
    shortcuts,
    groupAutoFitRuntime,
    nodeMeasureQueue,
    scheduler
  })

  instance.runtime.applyConfig = runtimePort.applyConfig
  instance.runtime.dispose = runtimePort.dispose

  return {
    state: instance.state,
    runtime: instance.runtime,
    query: instance.query,
    read: instance.read,
    commands: instance.commands
  }
}
