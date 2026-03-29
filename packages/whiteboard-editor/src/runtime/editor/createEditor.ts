import { createValueStore } from '@whiteboard/engine'
import type { EdgeConnectCandidate } from '@whiteboard/core/edge'
import type { EngineInstance } from '@whiteboard/engine'
import type {
  Editor,
  EditorHostBridge,
  EditorRuntime,
} from './types'
import type { Tool } from '../tool'
import {
  isSameTool,
  normalizeTool
} from '../tool'
import { createViewport } from '../viewport/createViewport'
import type { NodeRegistry } from '../../types/node'
import {
  createInteractionCoordinator,
  createSnapRuntime
} from '../interaction'
import { createPickRuntime } from '../pick'
import { createMindmapDragSession } from '../../features/mindmap/dragSession'
import { createMarqueeSession } from '../../features/selection/marquee'
import { createSelectionGesture } from '../../features/selection/gesture'
import { createTransformSession } from '../../features/node/session/transform'
import { createEdgeConnectSession } from '../../features/edge/connectSession'
import {
  createEditorCommandRuntime,
  createEditorCommands
} from '../commands'
import { createInputCommands } from '../commands/input'
import type {
  Viewport
} from '@whiteboard/core/types'
import { createDrawInputRuntime } from '../../features/draw/input'
import { createEdgeInputRuntime } from '../../features/edge/input'
import {
  createContextRuntime,
  createSelectionMenuRead,
  type ContextMenuView
} from '../context'
import { createRuntimeRead } from '../read'
import type { PointerSnapshot } from '../input/pointerSnapshot'
import { createEditorPlatform } from './createEditorPlatform'
import { createEditorStores } from './createEditorStores'
import { createEditorLifecycle } from './createEditorLifecycle'
import { createEditorHost } from './createEditorHost'

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
}): Editor => {
  const platform = createEditorPlatform(host)
  const contextMenu = createValueStore<ContextMenuView | null>(null)
  const pointer = createValueStore<PointerSnapshot | null>(null)
  const viewport = createViewport({
    initialViewport,
    limits: viewportLimits
  })
  const interaction = createInteractionCoordinator({
    getViewport: () => viewport.input,
    pointerContinuation: platform.pointerContinuation,
    selectionLock: platform.selectionLock
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
    baseRead,
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
  let commands!: Editor['commands']
  const read = createRuntimeRead({
    base: baseRead,
    contextSelection: createSelectionMenuRead({
      editor: {
        commands: () => commands,
        registry
      },
      selection: baseRead.selection
    })
  })
  const commandRuntime = createEditorCommandRuntime({
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
    nodeRuntime: internals.node,
    clipboardRuntime: platform.clipboardRuntime,
    clipboardPort: platform.clipboardPort,
    readPointerWorld: () => pointer.get()?.world
  })
  commands = createEditorCommands({
    runtime: commandRuntime
  })
  const context = createContextRuntime(
    {
      commands,
      read,
      state,
      registry
    },
    contextMenu
  )
  commands.context = {
    open: context.open,
    dismiss: context.dismiss
  }
  const runtimeSessionDeps = {
    commands,
    config: engine.config,
    interaction,
    read,
    viewport: viewport.read
  }
  const marquee = createMarqueeSession({
    interaction,
    read,
    viewport: viewport.read
  })
  const gesture = createSelectionGesture(
    {
      ...runtimeSessionDeps,
      internals: {
        edge: internals.edge,
        node: internals.node,
        pick,
        snap
      }
    },
    marquee
  )
  const draw = createDrawInputRuntime({
    commands,
    interaction,
    read,
    state,
    viewport: viewport.read,
    internals: {
      node: internals.node
    }
  })
  const transform = createTransformSession({
    commands,
    interaction,
    read,
    viewport: viewport.read,
    internals: {
      node: internals.node,
      snap
    }
  })
  const edgeConnect = createEdgeConnectSession({
    ...runtimeSessionDeps,
    internals: {
      edge: internals.edge,
      snap
    }
  })
  const edgeInput = createEdgeInputRuntime(
    {
      ...runtimeSessionDeps,
      internals: {
        edge: internals.edge,
        snap
      }
    },
    edgeConnect
  )
  const mindmapDragController = createMindmapDragSession({
    ...runtimeSessionDeps,
    internals: {
      mindmapDrag: internals.mindmapDrag
    }
  })
  const editorHost = createEditorHost({
    registry,
    interaction,
    viewport,
    pick,
    snap,
    marquee,
    gesture,
    draw,
    internals,
    transform,
    edgeConnect,
    edgeInput,
    mindmapDragController
  })
  const input = createInputCommands({
    editor: {
      commands,
      read,
      state,
      host: editorHost,
      viewport: viewport.read
    },
    pointer
  })
  const lifecycle = createEditorLifecycle({
    engine,
    read,
    stores,
    input,
    interaction,
    context,
    snap,
    internals
  })

  const editor = {
    engine,
    host: editorHost,
    internals: {
      host: {
        clipboard: {
          runtime: platform.clipboardRuntime,
          port: platform.clipboardPort
        },
        selectionLock: platform.selectionLock,
        pointerContinuation: platform.pointerContinuation
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
    input,
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
      lifecycle.syncHistory()
    },
    dispose: lifecycle.dispose
  } satisfies EditorRuntime

  return editor
}
