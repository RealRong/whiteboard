import { createValueStore } from '@whiteboard/engine'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import { createDrawState } from '../../features/draw/state'
import { createEdgeProjection } from '../../features/edge/projection'
import { createMindmapDragProjectionStore } from '../../features/mindmap/drag/projection'
import { createNodeProjectionRuntime } from '../../features/node/projection/store'
import type { NodeRegistry } from '../../types/node'
import {
  isSameTool,
  normalizeTool,
  type Tool
} from '../tool'
import type {
  Editor,
  EditorPlatformBridge
} from '../../types/editor'
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

export const createEditor = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  inputPolicy: initialInputPolicy,
  registry,
  platform: platformBridge,
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
  platform?: EditorPlatformBridge
}): Editor => {
  const draw = createDrawState()
  const pointer = createValueStore<PointerSnapshot | null>(null)
  const nodeProjection = createNodeProjectionRuntime()
  const edgeProjection = createEdgeProjection()
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
    registry,
    platform: platformBridge
  })

  const read = createRead({
    engineRead: engine.read,
    registry,
    tool: kernel.tool,
    history: kernel.history,
    drawPreferences: draw.store,
    selection: kernel.selection.source,
    frame: kernel.frame.store,
    pick: kernel.pick,
    viewport: kernel.viewport.read,
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
    history: kernel.history,
    edit: kernel.edit.commands,
    selection: kernel.selection,
    frame: kernel.frame,
    viewportCommands: kernel.viewport.commands,
    viewportRead: kernel.viewport.read,
    draw,
    nodeProjection,
    clipboard: {
      runtime: kernel.clipboard.runtime,
      port: kernel.clipboard.port,
      readPointerWorld: () => pointer.get()?.world
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
      pick: kernel.pick,
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
    pick: kernel.pick,
    config: kernel.engine.config,
    read,
    state,
    commands,
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
      lifecycle.syncHistory()
    },
    dispose: lifecycle.dispose
  } satisfies EditorRuntime

  return editor
}
