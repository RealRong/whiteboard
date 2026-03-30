import { createValueStore } from '@whiteboard/engine'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import type { EditorPlatformBridge } from '../../types/editor'
import type { Tool } from '../tool'
import { normalizeTool } from '../tool'
import { createFrameState } from '../frame'
import { createEditState } from '../edit'
import { createSelectionState } from '../selection'
import { createInteractionCoordinator } from '../interaction'
import { createPickRuntime } from '../pick'
import { createViewport } from '../viewport'
import type {
  EditorInputPolicy,
  EditorKernel,
  EditorViewportRuntime
} from '../../types/internal/editor'
import type { Editor } from '../../types/editor'
import { composePlatform } from './composePlatform'

export const createKernel = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  inputPolicy: initialInputPolicy,
  registry,
  platform: platformBridge
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
}): {
  kernel: EditorKernel
  state: Editor['state']
  viewport: EditorViewportRuntime
} => {
  const {
    clipboardRuntime,
    clipboardPort,
    selectionLock,
    pointerContinuation
  } = composePlatform(platformBridge)
  const inputPolicy = createValueStore<EditorInputPolicy>({
    panEnabled: initialInputPolicy.panEnabled,
    wheelEnabled: initialInputPolicy.wheelEnabled,
    wheelSensitivity: initialInputPolicy.wheelSensitivity
  })
  const viewport = createViewport({
    initialViewport,
    limits: viewportLimits
  })
  const interaction = createInteractionCoordinator({
    getViewport: () => viewport.input,
    readPointer: viewport.read.pointer,
    pointerContinuation,
    selectionLock
  })
  const pick = createPickRuntime()

  const tool = createValueStore<Tool>(normalizeTool(initialTool))
  const history = createValueStore(engine.commands.history.get())
  const edit = createEditState()
  const frame = createFrameState(engine.read)
  const selection = createSelectionState()

  const kernel: EditorKernel = {
    engine,
    registry,
    history,
    viewport,
    pick,
    interaction,
    clipboard: {
      runtime: clipboardRuntime,
      port: clipboardPort
    },
    inputPolicy,
    tool,
    edit,
    frame,
    selection
  }

  const state: Editor['state'] = {
    tool,
    edit: edit.store,
    selection: selection.source,
    frame: frame.store
  }

  const editorViewport: EditorViewportRuntime = {
    get: viewport.read.get,
    subscribe: viewport.read.subscribe,
    pointer: viewport.read.pointer,
    worldToScreen: viewport.read.worldToScreen,
    input: viewport.input,
    setRect: viewport.setRect,
    setLimits: viewport.setLimits
  }

  return {
    kernel,
    state,
    viewport: editorViewport
  }
}
