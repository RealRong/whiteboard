import {
  isSameTool,
  normalizeTool
} from '../tool'
import type {
  EditorKernel,
  EditorProjectionGraph,
  EditorRuntime,
  EditorViewportRuntime
} from '../../types/internal/editor'
import type { Editor } from '../../types/public/editor'
import type { EditorFeatureCapsule } from '../../types/runtime/editor/capsule'

export const createPublic = ({
  kernel,
  read,
  state,
  commands,
  input,
  viewport,
  projection,
  projections,
  capsules,
  inputInternals,
  lifecycle
}: {
  kernel: EditorKernel
  read: Editor['read']
  state: Editor['state']
  commands: Editor['commands']
  input: Editor['input']
  viewport: EditorViewportRuntime
  projection: Editor['projection']
  projections: EditorProjectionGraph
  capsules: readonly EditorFeatureCapsule[]
  inputInternals: EditorRuntime['internals']['input']
  lifecycle: {
    syncHistory: () => void
    dispose: () => void
  }
}): EditorRuntime => {
  const editor = {
    interaction: kernel.interaction,
    registry: kernel.document.registry,
    pick: kernel.spatial.pick,
    internals: {
      kernel,
      projections,
      capsules,
      input: inputInternals
    },
    config: kernel.document.engine.config,
    read,
    state,
    commands,
    input,
    viewport,
    projection,
    configure: (config) => {
      const nextTool = normalizeTool(config.tool)
      if (!isSameTool(kernel.state.tool.get(), nextTool)) {
        kernel.state.tool.set(nextTool)
      }

      viewport.setLimits(config.viewport)
      kernel.config.inputPolicy.set({
        panEnabled: config.viewport.enablePan,
        wheelEnabled: config.viewport.enableWheel,
        wheelSensitivity: config.viewport.wheelSensitivity
      })
      kernel.document.engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
      lifecycle.syncHistory()
    },
    dispose: lifecycle.dispose
  } satisfies EditorRuntime

  return editor
}
