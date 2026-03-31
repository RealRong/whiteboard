import { createValueStore } from '@whiteboard/engine'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import type { Tool } from '../../types/tool'
import { createEditState } from '../state/edit'
import { createSelectionState } from '../state/selection'
import { createInteractionCoordinator } from '../interaction'
import { createViewport } from '../viewport'
import type {
  EditorInputPolicy,
  EditorKernel,
  EditorViewportRuntime
} from './types'
import type { Editor } from '../../types/editor'

export const createKernel = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  inputPolicy: initialInputPolicy,
  registry
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
}): {
  kernel: EditorKernel
  state: Editor['state']
  viewport: EditorViewportRuntime
} => {
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
    getViewport: () => viewport.input
  })

  const tool = createValueStore<Tool>(initialTool)
  const edit = createEditState()
  const selection = createSelectionState()

  const kernel: EditorKernel = {
    engine,
    registry,
    viewport,
    interaction,
    inputPolicy,
    tool,
    edit,
    selection
  }

  const state: Editor['state'] = {
    tool,
    edit: edit.source,
    selection: selection.source
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
