import { createValueStore } from '@whiteboard/engine'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import { createDrawState } from '../../runtime/draw'
import { createEdgeProjectionRuntime } from '../../runtime/projection/edge'
import { createMindmapDragProjectionStore } from '../../runtime/projection/mindmapDrag'
import { createNodeProjectionRuntime } from '../../runtime/projection/node'
import type { NodeRegistry } from '../../types/node'
import type { DrawPreferences } from '../../types/draw'
import type { InsertPresetCatalog } from '../../types/toolbox'
import {
  isSameTool,
  normalizeTool,
  type Tool
} from '../tool'
import type { Editor } from '../../types/editor'
import type {
  EditorInputPolicy,
  EditorRuntime
} from '../../types/internal/editor'
import { createEditorCommands } from '../commands'
import type { PointerSnapshot } from '../input/pointer/snapshot'
import { createSnapRuntime } from '../interaction'
import { createRead } from '../read'
import { composeInput } from './composeInput'
import { createInteractionFeatures } from './features/createInteractionFeatures'
import { createKernel } from './kernel'
import { createLifecycle } from './lifecycle'
import type { EditorFeatureContext } from '../../types/runtime/editor/featureContext'
import { createClipboard } from '../clipboard'

export const createEditor = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  inputPolicy: initialInputPolicy,
  registry,
  insertPresetCatalog,
  initialDrawPreferences
}: {
  engine: EngineInstance
  initialTool: Tool
  initialViewport: Viewport
  viewportLimits: {
    minZoom: number
    maxZoom: number
  }
  inputPolicy: EditorInputPolicy
  registry: NodeRegistry
  insertPresetCatalog: InsertPresetCatalog
  initialDrawPreferences: DrawPreferences
}): Editor => {
  const draw = createDrawState(initialDrawPreferences)
  const pointer = createValueStore<PointerSnapshot | null>(null)
  const nodeProjection = createNodeProjectionRuntime()
  const edgeProjection = createEdgeProjectionRuntime()
  const mindmapDragProjection = createMindmapDragProjectionStore()

  const {
    kernel,
    state,
    viewport: editorViewport
  } = createKernel({
    engine,
    initialTool,
    initialViewport,
    viewportLimits,
    inputPolicy: initialInputPolicy,
    registry
  })

  const read = createRead({
    engineRead: engine.read,
    registry,
    tool: kernel.tool,
    history: engine.history,
    drawPreferences: draw.store,
    selection: kernel.selection.source,
    frame: kernel.frame.store,
    node: nodeProjection,
    edge: edgeProjection
  })
  const snap = createSnapRuntime({
    readZoom: () => editorViewport.get().zoom,
    node: {
      config: engine.config.node,
      query: engine.read.index.snap.inRect
    },
    edge: {
      config: engine.config.edge,
      nodeSize: engine.config.nodeSize,
      query: read.edge.connect.candidatesInRect
    }
  })

  const commands = createEditorCommands({
    engine,
    read,
    state,
    tool: kernel.tool,
    edit: kernel.edit.commands,
    selection: kernel.selection,
    frame: kernel.frame,
    viewportCommands: kernel.viewport.commands,
    viewportRead: kernel.viewport.read,
    draw,
    nodeProjection,
    insertPresetCatalog
  })
  const clipboard = createClipboard({
    editor: {
      commands,
      read,
      viewport: kernel.viewport.read
    }
  })

  const featureContext: EditorFeatureContext = {
    commands,
    read,
    state,
    config: kernel.engine.config,
    viewport: editorViewport,
    interaction: kernel.interaction,
    registry: kernel.registry,
    inputPolicy: kernel.inputPolicy,
    draw,
    projection: {
      node: nodeProjection,
      edge: edgeProjection,
      mindmapDrag: mindmapDragProjection
    },
    spatial: {
      snap
    }
  }
  const features = createInteractionFeatures(featureContext)

  const input = composeInput({
    commands,
    read,
    state,
    viewport: editorViewport,
    interaction: kernel.interaction,
    policy: kernel.inputPolicy,
    pointer,
    interactions: features.interactions,
    passive: features.passive
  })

  const lifecycle = createLifecycle({
    kernel,
    read,
    input,
    featureLifecycle: features.lifecycle
  })

  const editor = {
    interaction: kernel.interaction,
    registry: kernel.registry,
    config: kernel.engine.config,
    read,
    state,
    commands,
    clipboard,
    input,
    viewport: editorViewport,
    projection: features.projection,
    configure: (config) => {
      const nextTool = normalizeTool(config.tool)
      if (!isSameTool(kernel.tool.get(), nextTool)) {
        kernel.tool.set(nextTool)
      }

      editorViewport.setLimits(config.viewport)
      kernel.inputPolicy.set({
        panEnabled: config.viewport.enablePan,
        wheelEnabled: config.viewport.enableWheel,
        wheelSensitivity: config.viewport.wheelSensitivity
      })
      kernel.engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: lifecycle.dispose
  } satisfies EditorRuntime

  return editor
}
