import { createValueStore } from '@whiteboard/engine'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import { createDrawState } from '../../features/draw/state'
import { createEdgeProjection } from '../../features/edge/projection'
import { createMindmapDragProjectionStore } from '../../features/mindmap/drag/projection'
import { createNodeProjectionRuntime } from '../../features/node/projection/store'
import type { NodeRegistry } from '../../types/node'
import type { Tool } from '../tool'
import type {
  Editor,
  EditorPlatformBridge
} from '../../types/public/editor'
import type { EditorInputPolicy } from '../../types/internal/editor'
import {
  createSelectionMenuRead,
  type ContextMenuView
} from '../context'
import { createEditorCommands } from '../commands'
import type { PointerSnapshot } from '../input/pointer/snapshot'
import {
  createBaseRuntimeRead,
  createRuntimeRead
} from '../read'
import { composeCommands } from './composeCommands'
import { composeInput } from './composeInput'
import { composeProjection } from './composeProjection'
import { composeRead } from './composeRead'
import { createFeatureCapsules } from './features/capsules'
import { createKernel } from './kernel'
import { createLifecycle } from './lifecycle'
import { createProjectionGraph } from './projectionGraph'
import { createPublic } from './public'

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
  const contextMenu = createValueStore<ContextMenuView | null>(null)
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

  const baseRead = createBaseRuntimeRead({
    engineRead: engine.read,
    registry,
    tool: kernel.state.tool,
    history: kernel.document.history,
    drawPreferences: draw.store,
    selection: kernel.state.selection.source,
    frame: kernel.state.frame.store,
    contextMenu,
    pick: kernel.spatial.pick,
    viewport: kernel.spatial.viewport.read,
    node: nodeProjection,
    edge: edgeProjection
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

  commands = createEditorCommands({
    engine,
    read,
    state,
    tool: kernel.state.tool,
    history: kernel.document.history,
    edit: kernel.state.edit.commands,
    selection: kernel.state.selection,
    frame: kernel.state.frame,
    viewportCommands: kernel.spatial.viewport.commands,
    viewportRead: kernel.spatial.viewport.read,
    draw,
    nodeProjection,
    clipboard: {
      runtime: kernel.platform.clipboardRuntime,
      port: kernel.platform.clipboardPort,
      readPointerWorld: () => pointer.get()?.world
    }
  })

  const { capsules } = createFeatureCapsules({
    kernel,
    read,
    state,
    commands,
    viewport: editorViewport,
    draw,
    nodeProjection,
    edgeProjection,
    mindmapDragProjection,
    contextMenu
  })

  const projections = createProjectionGraph(capsules)

  composeRead({
    base: read,
    capsules
  })
  commands = composeCommands({
    base: commands,
    capsules
  })

  const projection = composeProjection({
    projections,
    capsules
  })

  const {
    input,
    internals: inputInternals
  } = composeInput({
    commands,
    read,
    state,
    viewport: editorViewport,
    interaction: kernel.interaction,
    policy: kernel.config.inputPolicy,
    pointer,
    capsules
  })

  const lifecycle = createLifecycle({
    kernel,
    read,
    input,
    capsules
  })

  return createPublic({
    kernel,
    read,
    state,
    commands,
    input,
    viewport: editorViewport,
    projection,
    projections,
    capsules,
    inputInternals,
    lifecycle
  })
}
