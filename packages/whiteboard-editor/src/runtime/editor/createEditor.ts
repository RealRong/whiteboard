import { createValueStore } from '@whiteboard/engine'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import { createDrawPreferences } from '../../features/draw/preferences'
import { createEdgeGuide } from '../../runtime/feedback/edgeGuide'
import { createMarqueeFeedback } from '../../runtime/feedback/marquee'
import { createMindmapDragFeedback } from '../../runtime/feedback/mindmapDrag'
import { createEdgeTransient } from '../../runtime/transient/edge'
import { createNodeTransient } from '../../runtime/transient/node'
import type { NodeRegistry } from '../../types/node'
import type { DrawPreferences } from '../../types/draw'
import type { InsertPresetCatalog } from '../../types/insert'
import type { Tool } from '../../types/tool'
import type { Editor } from '../../types/editor'
import type { EditorInputPolicy } from './types'
import { createEditorCommands } from '../commands'
import type { PointerSnapshot } from '../input/pointer/snapshot'
import { createSnapRuntime } from '../interaction'
import { createRead } from '../read'
import { createFeatureRuntime } from './featureRuntime'
import { composeInput } from './composeInput'
import { assembleInteractions } from './assembleInteractions'
import { createKernel } from './kernel'
import { createLifecycle } from './lifecycle'
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
  const drawPreferences = createDrawPreferences(initialDrawPreferences)
  const pointer = createValueStore<PointerSnapshot | null>(null)
  const nodeTransient = createNodeTransient()
  const edgeTransient = createEdgeTransient()
  const edgeGuide = createEdgeGuide()

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
  const marquee = createMarqueeFeedback(editorViewport)
  const mindmapDrag = createMindmapDragFeedback()

  const read = createRead({
    engineRead: engine.read,
    registry,
    tool: kernel.tool,
    history: engine.history,
    drawPreferences: drawPreferences.store,
    selection: kernel.selection.source,
    node: nodeTransient.reader,
    edge: edgeTransient.reader
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
    tool: kernel.tool,
    edit: kernel.edit.mutate,
    selection: kernel.selection,
    viewportCommands: kernel.viewport.commands,
    drawPreferences,
    nodeTransient: nodeTransient.runtime,
    insertPresetCatalog
  })
  const clipboard = createClipboard({
    editor: {
      commands,
      read,
      viewport: kernel.viewport.read
    }
  })

  const featureRuntime = createFeatureRuntime({
    command: commands,
    read,
    config: kernel.engine.config,
    viewport: editorViewport,
    interaction: kernel.interaction,
    registry: kernel.registry,
    inputPolicy: kernel.inputPolicy,
    output: {
      edge: edgeTransient.runtime,
      node: nodeTransient.runtime,
      edgeGuide,
      marquee,
      mindmapDrag,
      snap
    }
  })
  const features = assembleInteractions(featureRuntime)

  const input = composeInput({
    read,
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
    feedback: features.feedback,
    configure: (config) => {
      commands.tool.set(config.tool)

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
  } satisfies Editor

  return editor
}
