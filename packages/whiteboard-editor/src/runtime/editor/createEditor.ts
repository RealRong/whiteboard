import { createValueStore } from '@whiteboard/engine'
import type { HistoryState } from '@whiteboard/core/kernel'
import type { EdgeConnectCandidate } from '@whiteboard/core/edge'
import type { EngineInstance } from '@whiteboard/engine'
import type {
  Editor,
  EditorHostBridge,
  InternalEditor,
} from './types'
import type { Tool } from '../tool'
import {
  isSameTool,
  normalizeTool
} from '../tool'
import {
  createState as createFrameState
} from '../frame'
import {
  createState as createEditState
} from '../edit'
import {
  createState as createSelectionState,
} from '../selection'
import { createViewport } from '../viewport/createViewport'
import type { NodeRegistry } from '../../types/node'
import {
  createInteractionCoordinator,
  createSnapRuntime,
  type InteractionCoordinator
} from '../interaction'
import {
  createBrowserClipboardPort,
  createClipboardRuntime
} from '../host/clipboard'
import { createBrowserDocumentSelectionLock } from '../host/selectionLock'
import { createBrowserPointerContinuation } from '../host/pointerContinuation'
import { createPickRuntime } from '../pick'
import { createNodeFeatureRuntime } from '../../features/node/session/node'
import { createEdgePreview } from '../../features/edge/preview'
import { createMindmapDragStore } from '../../features/mindmap/session/drag'
import { createMindmapDragSession } from '../../features/mindmap/dragSession'
import { createMarqueeSession } from '../../features/selection/marquee'
import { createSelectionGesture } from '../../features/selection/gesture'
import { createTransformSession } from '../../features/node/session/transform'
import { createEdgeConnectSession } from '../../features/edge/connectSession'
import { createEditorCommands } from '../commands'
import { createRuntimeRead } from '../read'
import type {
  Viewport
} from '@whiteboard/core/types'
import { finalize } from '../finalize'
import {
  createDrawState
} from '../../features/draw/state'
import { createDrawInputRuntime } from '../../features/draw/input'
import { createEdgeInputRuntime } from '../../features/edge/input'
import {
  createContextRuntime,
  type ContextMenuView
} from '../context'

type InstanceStores = {
  tool: ReturnType<typeof createValueStore<Tool>>
  history: ReturnType<typeof createValueStore<HistoryState>>
  draw: ReturnType<typeof createDrawState>
  edit: ReturnType<typeof createEditState>
  frame: ReturnType<typeof createFrameState>
  selection: ReturnType<typeof createSelectionState>
}

type InstanceInternals = {
  pick: ReturnType<typeof createPickRuntime>
  node: ReturnType<typeof createNodeFeatureRuntime>
  edge: {
    preview: ReturnType<typeof createEdgePreview>
  }
  mindmapDrag: ReturnType<typeof createMindmapDragStore>
}

const createDeferredInstance = () => {
  let current: InternalEditor | null = null

  return {
    bind: (instance: InternalEditor) => {
      current = instance
    },
    instance: new Proxy({} as InternalEditor, {
      get: (_target, property) => {
        if (!current) {
          throw new Error('Editor instance is not initialized')
        }

        return current[property as keyof InternalEditor]
      }
    })
  }
}

const createEditorStores = ({
  engine,
  initialTool,
  interaction,
  registry,
  contextMenu,
  pick,
  viewport
}: {
  engine: EngineInstance
  initialTool: Tool
  interaction: InteractionCoordinator
  registry: NodeRegistry
  contextMenu: ReturnType<typeof createValueStore<ContextMenuView | null>>
  pick: ReturnType<typeof createPickRuntime>
  viewport: ReturnType<typeof createViewport>['read']
}): {
  stores: InstanceStores
  state: Editor['state']
  read: Editor['read']
  internals: InstanceInternals
} => {
  const tool = createValueStore<Tool>(normalizeTool(initialTool))
  const history = createValueStore(engine.commands.history.get())
  const draw = createDrawState()
  const edit = createEditState()
  const frame = createFrameState(engine.read)
  const selection = createSelectionState()
  const node = createNodeFeatureRuntime()
  const edge = {
    preview: createEdgePreview()
  }
  const mindmapDrag = createMindmapDragStore()
  const read = createRuntimeRead({
    engineRead: engine.read,
    registry,
    tool,
    history,
    selection: selection.source,
    frame: frame.store,
    contextMenu,
    pick,
    viewport,
    node,
    edge: edge.preview
  })

  return {
    stores: {
      tool,
      history,
      draw,
      edit,
      frame,
      selection
    },
    state: {
      tool,
      draw: draw.store,
      edit: edit.store,
      selection: selection.source,
      frame: frame.store,
      interaction: interaction.state
    },
    read,
    internals: {
      pick,
      node,
      edge,
      mindmapDrag
    }
  }
}

export const createEditor = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  registry,
  host,
}: {
  engine: EngineInstance
  initialTool: Tool
  initialViewport: Viewport
  viewportLimits: {
    minZoom: number
    maxZoom: number
  }
  registry: NodeRegistry
  host?: EditorHostBridge
}): InternalEditor => {
  const clipboardRuntime = createClipboardRuntime()
  const clipboardPort = host?.clipboard ?? createBrowserClipboardPort()
  const selectionLock = host?.selectionLock ?? createBrowserDocumentSelectionLock()
  const pointerContinuation = host?.pointerContinuation ?? createBrowserPointerContinuation()
  const deferredInstance = createDeferredInstance()
  const contextMenu = createValueStore<ContextMenuView | null>(null)
  const viewport = createViewport({
    initialViewport,
    limits: viewportLimits
  })
  const interaction = createInteractionCoordinator({
    getViewport: () => viewport.input,
    pointerContinuation,
    selectionLock
  })
  const pick = createPickRuntime()
  const snap = createSnapRuntime({
    readZoom: () => viewport.read.get().zoom,
    node: {
      config: engine.config.node,
      query: engine.read.index.snap.inRect
    },
    edge: {
      config: engine.config.edge,
      nodeSize: engine.config.nodeSize,
      query: (rect) => {
        const nodeIds = engine.read.index.node.idsInRect(rect)
        const candidates: EdgeConnectCandidate[] = []

        for (let index = 0; index < nodeIds.length; index += 1) {
          const entry = engine.read.index.node.get(nodeIds[index])
          if (!entry) {
            continue
          }

          if ((registry.get(entry.node.type)?.connect ?? true) === false) {
            continue
          }

          candidates.push({
            nodeId: entry.node.id,
            node: entry.node,
            rect: entry.rect,
            aabb: entry.aabb,
            rotation: entry.rotation
          })
        }

        return candidates
      }
    }
  })
  const {
    stores,
    state,
    read,
    internals
  } = createEditorStores({
    engine,
    initialTool,
    interaction,
    registry,
    contextMenu,
    pick,
    viewport: viewport.read
  })
  const marquee = createMarqueeSession(deferredInstance.instance)
  const gesture = createSelectionGesture(
    deferredInstance.instance,
    marquee
  )
  const draw = createDrawInputRuntime(deferredInstance.instance)
  const transform = createTransformSession(deferredInstance.instance)
  const edgeConnect = createEdgeConnectSession(deferredInstance.instance)
  const edgeInput = createEdgeInputRuntime(
    deferredInstance.instance,
    edgeConnect
  )
  const mindmapDragController = createMindmapDragSession(deferredInstance.instance)
  const context = createContextRuntime(
    deferredInstance.instance,
    contextMenu
  )
  const syncHistory = () => {
    stores.history.set(engine.commands.history.get())
  }
  const unsubscribeCommit = engine.commit.subscribe(() => {
    syncHistory()
    const commit = engine.commit.get()
    if (!commit) {
      return
    }

    if (commit.kind === 'replace') {
      resetUiSessionState()
      return
    }

    finalize({
      read,
      frame: stores.frame,
      selection: stores.selection,
      edit: stores.edit
    })
  })

  const commands = createEditorCommands({
    engine,
    read,
    state,
    tool: stores.tool,
    history: stores.history,
    edit: stores.edit.commands,
    selection: stores.selection,
    frame: stores.frame,
    viewportCommands: viewport.commands,
    viewportRead: viewport.read,
    draw: stores.draw,
    context,
    clipboardRuntime,
    clipboardPort
  })
  const resetUiSessionState = () => {
    interaction.cancel()
    context.clear()
    stores.edit.commands.clear()
    stores.selection.commands.clear()
    stores.frame.commands.clear()
    snap.node.clear()
    internals.node.clear()
    internals.edge.preview.clear()
    internals.mindmapDrag.clear()
  }
  const editorHost: Editor['host'] = {
    registry,
    interaction,
    viewport,
    pick,
    snap,
    selection: {
      marquee,
      gesture
    },
    draw,
    node: {
      ...internals.node,
      transform
    },
    edge: {
      ...internals.edge,
      connect: edgeConnect,
      input: edgeInput
    },
    mindmap: {
      drag: internals.mindmapDrag,
      controller: mindmapDragController
    }
  }

  const instance = {
    engine,
    host: editorHost,
    internals: {
      host: {
        clipboard: {
          runtime: clipboardRuntime,
          port: clipboardPort
        },
        selectionLock,
        pointerContinuation
      },
      viewport,
      pick,
      snap,
      selection: {
        marquee,
        gesture
      },
      draw,
      node: editorHost.node,
      edge: editorHost.edge,
      mindmapDrag: internals.mindmapDrag,
      mindmapDragController
    },
    interaction,
    registry,
    config: engine.config,
    read,
    state,
    commands,
    viewport: viewport.read,
    configure: (config) => {
      const nextTool = normalizeTool(config.tool)
      if (!isSameTool(stores.tool.get(), nextTool)) {
        stores.tool.set(nextTool)
      }
      viewport.setLimits(config.viewport)
      engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
      syncHistory()
    },
    dispose: () => {
      unsubscribeCommit()
      resetUiSessionState()
      engine.dispose()
    }
  } satisfies InternalEditor
  deferredInstance.bind(instance)

  return instance
}
