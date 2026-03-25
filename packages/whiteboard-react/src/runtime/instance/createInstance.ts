import { createValueStore } from '@whiteboard/core/runtime'
import type { HistoryState } from '@whiteboard/core/kernel'
import type { EngineInstance } from '@whiteboard/engine'
import type {
  WhiteboardInstance,
  InternalInstance,
} from './types'
import type { Tool } from '../tool'
import {
  DEFAULT_DRAW_KIND,
  DEFAULT_EDGE_PRESET_KEY,
  HandTool,
  SelectTool,
  createDrawTool,
  createEdgeTool,
  isDrawBrushKind,
  isSameTool,
  normalizeTool
} from '../tool'
import {
  createState as createFrameState,
  hasEdge
} from '../frame'
import {
  createState as createEditState,
  type Commands as EditCommands
} from '../edit'
import {
  createState as createSelectionState,
  type Commands as SelectionCommands
} from '../selection'
import type {
  ViewportCommands
} from '../viewport'
import { createViewport } from '../viewport/createViewport'
import type { NodeRegistry } from '../../types/node'
import {
  createInteractionCoordinator,
  createSnapRuntime,
  type InteractionCoordinator
} from '../interaction'
import { createPickRuntime } from '../pick'
import { createNodeFeatureRuntime } from '../../features/node/session/runtime'
import { createEdgePreview } from '../../features/edge/preview'
import { createMindmapDragStore } from '../../features/mindmap/session/drag'
import { createRuntimeRead } from '../read'
import type { Viewport } from '@whiteboard/core/types'
import { finalize } from '../finalize'
import {
  createDrawState,
  readDrawSlot
} from '../../features/draw/state'

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

const createInstanceStores = ({
  engine,
  initialTool,
  interaction,
  registry,
  pick,
  viewport
}: {
  engine: EngineInstance
  initialTool: Tool
  interaction: InteractionCoordinator
  registry: NodeRegistry
  pick: ReturnType<typeof createPickRuntime>
  viewport: ReturnType<typeof createViewport>['read']
}): {
  stores: InstanceStores
  state: WhiteboardInstance['state']
  read: WhiteboardInstance['read']
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
    edit: edit.store,
    history,
    selection: selection.source,
    interaction: interaction.mode,
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
      interaction: interaction.mode
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

const createCommands = ({
  engine,
  tool,
  history,
  edit,
  selection,
  frame,
  viewport,
  draw
}: {
  engine: EngineInstance
  tool: ReturnType<typeof createValueStore<Tool>>
  history: ReturnType<typeof createValueStore<HistoryState>>
  edit: EditCommands
  selection: SelectionCommands
  frame: ReturnType<typeof createFrameState>
  viewport: ViewportCommands
  draw: ReturnType<typeof createDrawState>
}): WhiteboardInstance['commands'] => {
  const setTool = (nextTool: Tool) => {
    const normalized = normalizeTool(nextTool)
    if (normalized.type === 'draw') {
      edit.clear()
      selection.clear()
    }
    if (isSameTool(tool.get(), normalized)) return
    tool.set(normalized)
  }
  const syncHistory = () => {
    history.set(engine.commands.history.get())
  }

  const selectionCommands: WhiteboardInstance['commands']['selection'] = {
    replace: (input) => {
      edit.clear()
      selection.replace(input)
    },
    add: (input) => {
      edit.clear()
      selection.add(input)
    },
    remove: (input) => {
      edit.clear()
      selection.remove(input)
    },
    toggle: (input) => {
      edit.clear()
      selection.toggle(input)
    },
    selectAll: () => {
      edit.clear()
      const activeFrame = frame.store.get()
      selection.replace({
        nodeIds:
          activeFrame.id
            ? [...activeFrame.ids]
            : [...engine.read.node.list.get()],
        edgeIds:
          activeFrame.id
            ? engine.read.edge.list.get().filter((edgeId) => {
              const edge = engine.read.edge.item.get(edgeId)?.edge
              return edge ? hasEdge(activeFrame, edge) : false
            })
            : [...engine.read.edge.list.get()]
      })
    },
    clear: () => {
      edit.clear()
      selection.clear()
    }
  }

  const frameCommands: WhiteboardInstance['commands']['frame'] = {
    enter: (nodeId) => {
      selectionCommands.clear()
      frame.commands.enter(nodeId)
    },
    exit: () => {
      selectionCommands.clear()
      frame.commands.exit()
    },
    clear: () => {
      selectionCommands.clear()
      frame.commands.clear()
    }
  }

  const drawCommands: WhiteboardInstance['commands']['draw'] = {
    slot: (slot) => {
      const current = tool.get()
      if (current.type !== 'draw' || !isDrawBrushKind(current.kind)) {
        return
      }

      draw.commands.slot(current.kind, slot)
    },
    patch: (patch) => {
      const current = tool.get()
      if (current.type !== 'draw' || !isDrawBrushKind(current.kind)) {
        return
      }

      draw.commands.patch(
        current.kind,
        readDrawSlot(draw.store.get(), current.kind),
        patch
      )
    }
  }

  return {
    ...engine.commands,
    history: {
      get: engine.commands.history.get,
      clear: () => {
        engine.commands.history.clear()
        syncHistory()
      },
      undo: () => {
        const result = engine.commands.history.undo()
        syncHistory()
        return result
      },
      redo: () => {
        const result = engine.commands.history.redo()
        syncHistory()
        return result
      }
    },
    tool: {
      set: setTool,
      select: () => {
        setTool(SelectTool)
      },
      hand: () => {
        setTool(HandTool)
      },
      edge: (preset = DEFAULT_EDGE_PRESET_KEY) => {
        setTool(createEdgeTool(preset))
      },
      insert: (preset) => {
        setTool({
          type: 'insert',
          preset
        })
      },
      draw: (kind = DEFAULT_DRAW_KIND) => {
        setTool(createDrawTool(kind))
      }
    },
    draw: drawCommands,
    edit,
    selection: selectionCommands,
    frame: frameCommands,
    viewport,
    edge: engine.commands.edge
  }
}

export const createInstance = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  registry,
}: {
  engine: EngineInstance
  initialTool: Tool
  initialViewport: Viewport
  viewportLimits: {
    minZoom: number
    maxZoom: number
  }
  registry: NodeRegistry
}): InternalInstance => {
  const viewport = createViewport({
    initialViewport,
    limits: viewportLimits
  })
  const interaction = createInteractionCoordinator({
    getViewport: () => viewport.input
  })
  const pick = createPickRuntime()
  const snap = createSnapRuntime({
    config: engine.config.node,
    readZoom: () => viewport.read.get().zoom,
    query: engine.read.index.snap.inRect
  })
  const {
    stores,
    state,
    read,
    internals
  } = createInstanceStores({
    engine,
    initialTool,
    interaction,
    registry,
    pick,
    viewport: viewport.read
  })

  const resetUiSessionState = () => {
    interaction.cancel()
    stores.edit.commands.clear()
    stores.selection.commands.clear()
    stores.frame.commands.clear()
    snap.clear()
    internals.node.clear()
    internals.edge.preview.clear()
    internals.mindmapDrag.clear()
  }
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

  const commands = createCommands({
    engine,
    tool: stores.tool,
    history: stores.history,
    edit: stores.edit.commands,
    selection: stores.selection.commands,
    frame: stores.frame,
    viewport: viewport.commands,
    draw: stores.draw
  })

  return {
    engine,
    internals: {
      viewport,
      snap,
      ...internals
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
  }
}
